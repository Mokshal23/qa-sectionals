import { Question, scoreQuestion } from "./domain";

export type RetryResult = { answer: string; answeredAt: string; solutionWasOpen: boolean };
export type MistakeLabel = "concept" | "decision" | "execution" | "focus" | "other";

export function scoreAttempt(questions: Question[], answers: Record<string, string>) {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let blank = 0;
  const byQuestion = Object.fromEntries(questions.map((question) => {
    const item = scoreQuestion(question, answers[question.id] ?? "");
    score += item.marks;
    if (item.status === "correct") correct += 1;
    if (item.status === "incorrect") incorrect += 1;
    if (item.status === "blank") blank += 1;
    return [question.id, item];
  }));
  return { score, correct, incorrect, blank, byQuestion };
}

export function retryPotential(
  questions: Question[],
  answers: Record<string, string>,
  retries: Record<string, RetryResult>,
) {
  const original = scoreAttempt(questions, answers);
  let recoveredMarks = 0;
  const recoveredQuestionIds: string[] = [];
  for (const question of questions) {
    const retry = retries[question.id];
    if (!retry || retry.solutionWasOpen) continue;
    const first = original.byQuestion[question.id];
    const second = scoreQuestion(question, retry.answer);
    if (first.status !== "correct" && second.status === "correct") {
      recoveredMarks += 3 - first.marks;
      recoveredQuestionIds.push(question.id);
    }
  }
  return {
    actualScore: original.score,
    recoveredMarks,
    potentialScore: original.score + recoveredMarks,
    recoveredQuestionIds,
  };
}
