import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error("Usage: node scripts/prepare-bank.mjs <source.json> <output.json>");
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const source = JSON.parse(await readFile(inputPath, "utf8"));
const rows = Array.isArray(source) ? source : source.questions;
if (!Array.isArray(rows)) throw new Error("Input JSON must be an array or contain a questions array.");

const normalizeDifficulty = (value) => {
  const match = String(value ?? "").match(/(?:TYPE\s*)?([ABC])\b/i);
  return match ? match[1].toUpperCase() : null;
};
const normalizeResponseType = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MCQ") return "MCQ";
  if (normalized === "TITA" || normalized === "NON-MCQ" || normalized === "NON MCQ") return "TITA";
  return null;
};
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const questions = rows.map((row, index) => {
  const questionId = String(row.question_id ?? row.id ?? row.global_id ?? index + 1);
  const options = Array.isArray(row.options)
    ? row.options.map((option, optionIndex) => ({
        id: String(option.identifier ?? option.id ?? String.fromCharCode(65 + optionIndex)),
        text: String(option.text ?? option.value ?? ""),
      }))
    : [];
  const solution = String(row.solution ?? "").trim();
  return {
    id: questionId,
    prompt: String(row.question_text ?? row.prompt ?? "").trim(),
    promptHtml: String(row.question_html ?? row.promptHtml ?? "").trim(),
    options,
    answer: String(row.correct_answer ?? row.answer ?? "").trim(),
    solution,
    solutionHtml: String(row.solution_html ?? row.solutionHtml ?? "").trim(),
    pillar: String(row.pillar ?? row.subject ?? row.topic_group ?? "Unclassified").trim(),
    topic: String(row.topic ?? row.subtopic ?? "Unclassified").trim(),
    area: String(row.area ?? "").trim(),
    difficulty: normalizeDifficulty(row.classification ?? row.difficulty),
    responseType: normalizeResponseType(row.format ?? row.responseType),
    pValue: toFiniteNumber(row.p_value ?? row.pValue),
    pValueUnit: "source-percent",
    hasSolution: solution.length > 0,
  };
});

const invalid = questions.filter((question) =>
  !question.id || !question.answer || !question.difficulty || !question.responseType ||
  (!question.prompt && !question.promptHtml),
);
if (invalid.length) {
  throw new Error(`${invalid.length} questions are missing an id, prompt, answer, difficulty, or response type.`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  sourceName: "CAT_ALL_33_MOCKS_QUANTS_QUESTIONS.json",
  pValueMeaning: "Combined source rate, preserved without decomposition",
  questionCount: questions.length,
  questions,
}, null, 2)}\n`, "utf8");
console.log(`Prepared ${questions.length} questions; excluded prior answers, results, marks, and personal time fields.`);
