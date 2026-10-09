import { describe, expect, it } from "vitest";
import { parseQuestionImport, validateQuestionImport } from "./import";
import { AttemptRecord, Question, isQuestionComplete, scoreQuestion, topicBucket } from "./domain";
import { generateSectionals } from "./generator";
import { analyzeAttempt } from "./analytics";

function syntheticBank(): Question[] {
  const plan: Array<["A"|"B"|"C", Record<string,number>]> = [
    ["A", { Arithmetic: 5, Algebra: 4, Geometry: 1, "Number System": 1, "Modern Math": 1 }],
    ["B", { Arithmetic: 8, Algebra: 6, Geometry: 3, "Number System": 3, "Modern Math": 0 }],
    ["C", { Arithmetic: 6, Algebra: 4, Geometry: 2, "Number System": 0, "Modern Math": 0 }],
  ];
  const questions: Question[] = [];
  for (const [difficulty, topics] of plan) for (const [topic, count] of Object.entries(topics)) for (let index = 0; index < count; index += 1) {
    const id = `q-${difficulty}-${topic.toLowerCase().replaceAll(" ", "-")}-${index + 1}`;
    questions.push({ id, prompt: "Choose the correct value.", promptHtml: "", options: [{ id: "A", text: "1" }, { id: "B", text: "2" }, { id: "C", text: "3" }, { id: "D", text: "4" }], answer: "B", solution: "A worked solution.", solutionHtml: "", pillar: topic, topic, area: topic, difficulty, responseType: "MCQ", pValue: index % 2 ? 27.49 : null, pValueUnit: "source-percent", hasSolution: true });
  }
  return questions;
}

describe("question import", () => {
  it("preserves keys, solution, topic, type, difficulty, and combined P-value without carrying personal attempt fields", () => {
    const input = JSON.stringify({ questions: [{ id: "q1", question_text: "Stem", options: [{ id: "A", text: "One" }, { id: "B", text: "Two" }], correct_answer: "B", solution: "Because two.", topic: "Algebra", pillar: "Algebra", classification: "Type C", format: "MCQ", p_value: 27.49, p_value_unit: "source-percent", user_answer: "A", marks_obtained: -1, your_time_sec: 80 }] });
    const [question] = parseQuestionImport(input, "bank.json");
    expect(question).toMatchObject({ id: "q1", prompt: "Stem", answer: "B", solution: "Because two.", topic: "Algebra", difficulty: "C", responseType: "MCQ", pValue: 27.49, pValueUnit: "source-percent" });
    expect(question).not.toHaveProperty("user_answer");
    expect(validateQuestionImport([question]).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reads CSV choices and rejects unlabelled difficulty instead of silently assigning one", () => {
    const csv = 'id,prompt,options,answer,solution,pillar,topic,difficulty,response_type,p_value,p_value_unit\nq2,"A, B, C?","[{""id"":""A"",""text"":""1""},{""id"":""B"",""text"":""2""}]",B,Work,Arithmetic,Ratio,A,TITA,14.2,source-percent';
    const [question] = parseQuestionImport(csv, "bank.csv");
    expect(question).toMatchObject({ prompt: "A, B, C?", difficulty: "A", responseType: "TITA", pValue: 14.2, options: [{ id: "A", text: "1" }, { id: "B", text: "2" }] });
    expect(() => parseQuestionImport(JSON.stringify([{ id: "q3", prompt: "Stem", answer: "1" }]), "bad.json")).toThrow(/difficulty label/);
  });

  it("treats an image-only HTML solution as a complete solution", () => {
    const [question] = parseQuestionImport(JSON.stringify([{ id: "q-html", question_text: "Stem", options: [{ id: "A", text: "1" }, { id: "B", text: "2" }], correct_answer: "B", solution_html: "<div><img src=\"https://example.com/solution.png\"></div>", pillar: "Algebra", topic: "Equations", classification: "A", format: "MCQ" }]), "bank.json");
    expect(question.hasSolution).toBe(true);
    expect(isQuestionComplete(question)).toBe(true);
  });
});

describe("CAT scoring", () => {
  it("applies positive, negative, and TITA no-penalty rules", () => {
    const mcq = syntheticBank()[0];
    expect(scoreQuestion(mcq, "B").marks).toBe(3);
    expect(scoreQuestion(mcq, "A").marks).toBe(-1);
    expect(scoreQuestion(mcq, "").marks).toBe(0);
    expect(scoreQuestion({ ...mcq, responseType: "TITA", answer: "128" }, "127").marks).toBe(0);
    expect(scoreQuestion({ ...mcq, responseType: "TITA", answer: "128" }, "128").marks).toBe(3);
  });
});

describe("sectional assembly", () => {
  it("makes complete forms with exact difficulty quotas, topic targets, and no repeated questions", () => {
    const result = generateSectionals(syntheticBank());
    expect(result.maxForms).toBe(2);
    expect(result.forms).toHaveLength(2);
    expect(result.forms.every((form) => form.questions.length === 22)).toBe(true);
    expect(result.forms.every((form) => form.difficultyCounts.A === 6 && form.difficultyCounts.B === 10 && form.difficultyCounts.C === 6)).toBe(true);
    const allIds = result.forms.flatMap((form) => form.questionIds);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(result.topicGeneratedCounts).toEqual(result.topicTargetCounts);
  });

  it("reports the difficulty band limiting form count", () => {
    const bank = syntheticBank().filter((question) => question.difficulty !== "C");
    const result = generateSectionals(bank);
    expect(result.maxForms).toBe(0);
    expect(result.limitingCategory).toContain("Type C");
  });
});

describe("topic classification", () => {
  it("uses specific concepts before inconsistent broad labels in imported banks", () => {
    expect(topicBucket({ pillar: "Modern Math", area: "Modern Math", topic: "Logarithms" })).toBe("Algebra");
    expect(topicBucket({ pillar: "Algebra", area: "Modern Math", topic: "Functions" })).toBe("Algebra");
    expect(topicBucket({ pillar: "Algebra", area: "Modern Math", topic: "Sequence & Series" })).toBe("Algebra");
    expect(topicBucket({ pillar: "Modern Math", area: "Algebra", topic: "Permutation & Combination" })).toBe("Modern Math");
  });
});

describe("event-derived analytics", () => {
  it("counts active time and visits, and only credits correct retries before a solution", () => {
    const [mcq] = syntheticBank();
    const tita: Question = { ...mcq, id: "tita", topic: "Algebra", responseType: "TITA", answer: "8" };
    const attempt: AttemptRecord = {
      id: "a1", userId: "u1", sectionalId: "s1", startedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:40:00.000Z",
      answers: { [mcq.id]: "A", [tita.id]: "" }, retryAnswers: {}, mistakeLabels: {}, solutionOpened: [],
      events: [
        { id: "1", type: "question_opened" as const, questionId: mcq.id, at: "2026-01-01T00:00:01.000Z" },
        { id: "2", type: "question_left" as const, questionId: mcq.id, at: "2026-01-01T00:00:06.000Z", durationSeconds: 5, active: true },
        { id: "3", type: "question_opened" as const, questionId: mcq.id, at: "2026-01-01T00:00:07.000Z" },
        { id: "4", type: "question_left" as const, questionId: mcq.id, at: "2026-01-01T00:00:47.000Z", durationSeconds: 40, active: true, metadata: { visitClosed: true } },
        { id: "5", type: "retry_answered" as const, questionId: mcq.id, at: "2026-01-01T00:41:00.000Z", value: "B", metadata: { solutionWasOpen: false } },
      ],
    };
    const report = analyzeAttempt([mcq, tita], attempt);
    expect(report.score).toBe(-1);
    expect(report.questions[mcq.id].timeSeconds).toBe(45);
    expect(report.questions[mcq.id].visits).toBe(2);
    expect(report.questions[mcq.id].glances).toBe(1);
    expect(report.potential).toMatchObject({ actualScore: -1, recoveredMarks: 4, potentialScore: 3 });
    expect(report.questions[mcq.id].retryCorrectBeforeSolution).toBe(true);
  });
});
