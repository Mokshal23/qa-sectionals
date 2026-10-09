export type Difficulty = "A" | "B" | "C";
export type ResponseType = "MCQ" | "TITA";
export type TopicBucket = "Arithmetic" | "Algebra" | "Geometry" | "Number System" | "Modern Math";

export type Choice = { id: string; text: string };

export type Question = {
  id: string;
  prompt: string;
  promptHtml: string;
  options: Choice[];
  answer: string;
  solution: string;
  solutionHtml: string;
  pillar: string;
  topic: string;
  area: string;
  difficulty: Difficulty;
  responseType: ResponseType;
  pValue: number | null;
  pValueUnit: string;
  hasSolution: boolean;
};

export type AnswerStatus = "correct" | "incorrect" | "blank";
export type ScoredAnswer = { status: AnswerStatus; marks: number; normalizedAnswer: string };
export type QuestionBankFile = { sourceName: string; pValueMeaning: string; questionCount: number; questions: Question[] };

export const DIFFICULTY_QUOTAS: Record<Difficulty, number> = { A: 6, B: 10, C: 6 };
export const DIFFICULTIES: Difficulty[] = ["A", "B", "C"];
export const TOPIC_SHARES: Record<TopicBucket, number> = {
  Arithmetic: 0.421,
  Algebra: 0.318,
  Geometry: 0.145,
  "Number System": 0.094,
  "Modern Math": 0.021,
};
export const TOPIC_BUCKETS = Object.keys(TOPIC_SHARES) as TopicBucket[];
export const TEST_QUESTION_COUNT = 22;
export const TEST_DURATION_SECONDS = 40 * 60;

export function topicBucket(question: Pick<Question, "pillar" | "area" | "topic">): TopicBucket | null {
  const values = `${question.pillar} ${question.area} ${question.topic}`.toLowerCase();
  if (/modern|permutation|combination|probability|set theory/.test(values)) return "Modern Math";
  if (/number system|number|factor|multiple|remainder|divisibility/.test(values)) return "Number System";
  if (/geometry|mensuration|triangle|circle|polygon|quadrilateral/.test(values)) return "Geometry";
  if (/algebra|equation|inequalit|function|logarithm|progression|polynomial/.test(values)) return "Algebra";
  if (/arithmetic|ratio|percentage|profit|loss|interest|work|speed|distance|average|mixture|alligation/.test(values)) return "Arithmetic";
  return null;
}

export function isQuestionComplete(question: Question): boolean {
  const hasPrompt = Boolean(question.prompt.trim() || question.promptHtml.trim());
  const hasAnswer = Boolean(question.answer.trim());
  const hasCorrectOptions = question.responseType !== "MCQ" || question.options.length >= 2;
  return hasPrompt && hasAnswer && question.hasSolution && hasCorrectOptions && Boolean(topicBucket(question));
}

export function normalizeAnswer(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "").replace(/,/g, "").toLowerCase();
}

export function scoreQuestion(question: Question, answer: unknown): ScoredAnswer {
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedAnswer) return { status: "blank", marks: 0, normalizedAnswer };
  const correct = normalizedAnswer === normalizeAnswer(question.answer);
  if (question.responseType === "TITA") {
    const expectedNumber = Number(normalizeAnswer(question.answer));
    const actualNumber = Number(normalizedAnswer);
    const numericMatch = Number.isFinite(expectedNumber) && Number.isFinite(actualNumber) && Math.abs(expectedNumber - actualNumber) < 1e-9;
    return { status: correct || numericMatch ? "correct" : "incorrect", marks: correct || numericMatch ? 3 : 0, normalizedAnswer };
  }
  return { status: correct ? "correct" : "incorrect", marks: correct ? 3 : -1, normalizedAnswer };
}

export type AttemptEventType =
  | "question_opened"
  | "question_left"
  | "answer_changed"
  | "answer_cleared"
  | "review_marked"
  | "review_unmarked"
  | "focus_changed"
  | "retry_answered"
  | "solution_opened"
  | "mistake_labeled"
  | "submitted";

export type AttemptEvent = {
  id: string;
  type: AttemptEventType;
  questionId?: string;
  at: string;
  durationSeconds?: number;
  active?: boolean;
  value?: string | boolean;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AttemptRecord = {
  id: string;
  userId: string;
  sectionalId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: Record<string, string>;
  retryAnswers: Record<string, string>;
  mistakeLabels: Record<string, string>;
  solutionOpened: string[];
  events: AttemptEvent[];
};
