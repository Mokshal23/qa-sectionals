import { readFile } from "node:fs/promises";
import path from "node:path";
import { Question, QuestionBankFile, isQuestionComplete, questionHasSolution, topicBucket } from "./domain";

let cachedBank: QuestionBankFile | null = null;

export async function loadQuestionBank(): Promise<QuestionBankFile> {
  if (cachedBank) return cachedBank;
  const filePath = path.join(process.cwd(), "data", "question-bank.json");
  const contents = await readFile(filePath, "utf8");
  cachedBank = JSON.parse(contents) as QuestionBankFile;
  return cachedBank;
}

export function summarizeBank(questions: Question[]) {
  const difficultyCounts = { A: 0, B: 0, C: 0 };
  const readyCounts = { A: 0, B: 0, C: 0 };
  const topicCounts = new Map<string, number>();
  const formatCounts = { MCQ: 0, TITA: 0 };
  let missingSolution = 0;
  let missingPrompt = 0;
  for (const question of questions) {
    difficultyCounts[question.difficulty] += 1;
    if (isQuestionComplete(question)) readyCounts[question.difficulty] += 1;
    const topic = topicBucket(question) ?? "Unclassified";
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    formatCounts[question.responseType] += 1;
    if (!questionHasSolution(question)) missingSolution += 1;
    if (!question.prompt.trim() && !question.promptHtml.trim()) missingPrompt += 1;
  }
  return {
    total: questions.length,
    ready: Object.values(readyCounts).reduce((sum, count) => sum + count, 0),
    missingSolution,
    missingPrompt,
    difficultyCounts,
    readyCounts,
    topicCounts: Object.fromEntries(topicCounts.entries()),
    formatCounts,
    withPValue: questions.filter((question) => question.pValue !== null).length,
  };
}
