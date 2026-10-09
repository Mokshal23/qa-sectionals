import Papa from "papaparse";
import { Choice, Difficulty, Question, ResponseType } from "./domain";

type RawQuestion = Record<string, unknown>;
export type ImportIssue = { row: number; id: string; severity: "error" | "warning"; message: string };

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

const allowedChoiceImageHost = "quizky-images.s3.ap-south-1.amazonaws.com";

function safeChoiceImage(value: unknown): Pick<Choice, "imageData" | "imageUrl"> {
  const source = asString(value);
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(source) && source.length <= 1_000_000) {
    return { imageData: source };
  }
  try {
    const url = new URL(source);
    if (url.protocol === "https:" && url.hostname === allowedChoiceImageHost && !url.username && !url.password && !url.port) {
      return { imageUrl: url.toString() };
    }
  } catch {
    // Non-URL values are simply not treated as choice images.
  }
  return {};
}

function imageSourceFromHtml(value: unknown): string {
  const html = asString(value);
  return html.match(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
}

function decodeOptionText(value: string, rawHtml: string): string {
  if (!value || !rawHtml.includes(value) || value.length < 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return value;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
    return decoded.length > 0 && /^[\x20-\x7e]+$/.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

function difficultyOf(value: unknown): Difficulty | null {
  const match = asString(value).match(/(?:TYPE\s*)?([ABC])\b/i);
  return match ? (match[1].toUpperCase() as Difficulty) : null;
}

function responseTypeOf(value: unknown): ResponseType | null {
  const label = asString(value).toUpperCase().replace(/[-_ ]/g, "");
  if (label === "MCQ") return "MCQ";
  if (label === "TITA" || label === "NONMCQ") return "TITA";
  return null;
}

function parseOptions(value: unknown, row: RawQuestion): Choice[] {
  if (Array.isArray(value)) {
    return value.map((option, index) => {
      if (typeof option === "string" || typeof option === "number") {
        return { id: String.fromCharCode(65 + index), text: asString(option) };
      }
      const candidate = option as Record<string, unknown>;
      const rawHtml = asString(candidate.raw_html ?? candidate.html ?? candidate.rawHtml);
      const text = decodeOptionText(asString(candidate.text ?? candidate.value), rawHtml);
      const image = safeChoiceImage(candidate.imageData ?? candidate.image_data ?? candidate.imageUrl ?? candidate.image_url ?? imageSourceFromHtml(rawHtml));
      // Keep source superscripts/subscripts so formulas render as math instead of
      // exposing the lossy plain-text fallback (for example, 0.25^99).
      const html = /<(?:sup|sub)\b/i.test(rawHtml) ? rawHtml.slice(0, 8000) : undefined;
      return { id: asString(candidate.identifier ?? candidate.id ?? String.fromCharCode(65 + index)), text, ...(html ? { html } : {}), ...image };
    });
  }
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return parseOptions(JSON.parse(value), row);
    } catch {
      return [];
    }
  }
  return ["A", "B", "C", "D", "E"].flatMap((key) => {
    const rawHtml = asString(row[`option_${key.toLowerCase()}_html`] ?? row[`option${key}_html`]);
    const text = decodeOptionText(asString(row[`option_${key.toLowerCase()}`] ?? row[`option${key}`]), rawHtml);
    const image = safeChoiceImage(imageSourceFromHtml(rawHtml) || row[`option_${key.toLowerCase()}_image_url`] || row[`option${key}ImageUrl`]);
    const html = /<(?:sup|sub)\b/i.test(rawHtml) ? rawHtml.slice(0, 8000) : undefined;
    return text || html || image.imageData || image.imageUrl ? [{ id: key, text, ...(html ? { html } : {}), ...image }] : [];
  });
}

export function normalizeImportRows(input: unknown): Question[] {
  const rawQuestions = Array.isArray(input)
    ? input as RawQuestion[]
    : Array.isArray((input as { questions?: unknown[] } | null)?.questions)
      ? (input as { questions: RawQuestion[] }).questions
      : [];
  return rawQuestions.map((row, index) => {
    const solution = asString(row.solution ?? row.solution_text);
    const pValueInput = row.p_value ?? row.pValue ?? row.p_value_percent;
    const pValue = pValueInput === "" || pValueInput === null || pValueInput === undefined ? null : Number(pValueInput);
    const difficulty = difficultyOf(row.classification ?? row.difficulty);
    const responseType = responseTypeOf(row.format ?? row.response_type ?? row.responseType);
    if (!difficulty) throw new Error(`Question row ${index + 1} is missing a valid A/B/C difficulty label.`);
    if (!responseType) throw new Error(`Question row ${index + 1} is missing a valid MCQ/TITA response type.`);
    if (pValueInput !== "" && pValueInput !== null && pValueInput !== undefined && !Number.isFinite(pValue)) throw new Error(`Question row ${index + 1} has a non-numeric P-value; preserve it as a number or leave it blank.`);
    return {
      id: asString(row.question_id ?? row.id ?? row.global_id ?? `import-${index + 1}`),
      prompt: asString(row.question_text ?? row.prompt ?? row.stem),
      promptHtml: asString(row.question_html ?? row.prompt_html ?? row.promptHtml),
      options: parseOptions(row.options, row),
      answer: asString(row.correct_answer ?? row.answer ?? row.answer_key),
      solution,
      solutionHtml: asString(row.solution_html ?? row.solutionHtml),
      pillar: asString(row.pillar ?? row.subject ?? row.topic_group ?? "Unclassified"),
      topic: asString(row.topic ?? row.subtopic ?? "Unclassified"),
      area: asString(row.area),
      difficulty,
      responseType,
      pValue: Number.isFinite(pValue) ? pValue : null,
      pValueUnit: asString(row.p_value_unit ?? row.pValueUnit ?? "source-supplied"),
      hasSolution: Boolean(solution || asString(row.solution_html ?? row.solutionHtml)),
    };
  });
}

export function parseQuestionImport(text: string, fileName: string): Question[] {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const parsed = Papa.parse<RawQuestion>(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
    if (parsed.errors.length) throw new Error(parsed.errors.map((error) => error.message).join("; "));
    return normalizeImportRows(parsed.data);
  }
  if (extension === "json") return normalizeImportRows(JSON.parse(text) as unknown);
  throw new Error("Choose a .json or .csv question bank.");
}

export function validateQuestionImport(questions: Question[]): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    const row = index + 1;
    const id = question.id || `row-${row}`;
    if (seen.has(id)) issues.push({ row, id, severity: "error", message: "Question ID is duplicated." });
    seen.add(id);
    if (!question.prompt && !question.promptHtml) issues.push({ row, id, severity: "error", message: "Question prompt is missing." });
    if (!question.answer) issues.push({ row, id, severity: "error", message: "Correct answer is missing." });
    if (!question.hasSolution) issues.push({ row, id, severity: "warning", message: "Solution is missing; this question cannot be placed in a published sectional." });
    if (question.responseType === "MCQ" && question.options.length < 2) issues.push({ row, id, severity: "error", message: "MCQ requires at least two choices." });
    if (question.responseType === "MCQ" && question.options.some((choice) => !choice.text && !choice.html && !choice.imageData && !choice.imageUrl)) issues.push({ row, id, severity: "error", message: "Every MCQ choice needs readable text, math markup, or a supported image." });
    if (!question.pillar || question.pillar === "Unclassified") issues.push({ row, id, severity: "warning", message: "Topic area is not classified." });
  });
  return issues;
}
