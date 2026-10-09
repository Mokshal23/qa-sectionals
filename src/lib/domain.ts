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

export function questionHasSolution(question: Pick<Question, "solution" | "solutionHtml">): boolean {
  return Boolean(question.solution.trim() || question.solutionHtml.trim());
}

export function topicBucket(question: Pick<Question, "pillar" | "area" | "topic">): TopicBucket | null {
  const topic = question.topic.toLowerCase();
  const area = question.area.toLowerCase();
  const pillar = question.pillar.toLowerCase();

  // Classify the actual concept before the broad source tags. Some banks put
  // Algebra subtopics under a "Modern Math" pillar/area.
  if (/permutation|combination|probability|set theory|binomial theorem/.test(topic)) return "Modern Math";
  if (/number system|factor|multiple|remainder|divisibility|surds?|indices|factorial|base system|hcf|number line|types of numbers|decimals|fractions|odd|even|mathematical operations/.test(topic)) return "Number System";
  if (/geometry|mensuration|triangle|circle|polygon|quadrilateral|coordinate geometry|trigonometry/.test(topic)) return "Geometry";
  if (/arithmetic|ratio|percentage|profit|loss|interest|work|speed|distance|average|mixture|alligation|partnership|sici|clock|calendar|word problem/.test(topic)) return "Arithmetic";
  if (/algebra|equation|inequalit|function|logarithm|progression|sequence|polynomial|modulus|maxima|minima/.test(topic)) return "Algebra";

  const broadLabels = `${pillar} ${area}`;
  if (/number system|numbers/.test(broadLabels)) return "Number System";
  if (/geometry|mensuration/.test(broadLabels)) return "Geometry";
  if (/arithmetic/.test(broadLabels)) return "Arithmetic";
  if (/algebra/.test(broadLabels)) return "Algebra";
  if (/modern math/.test(broadLabels)) return "Modern Math";
  return null;
}

export function isQuestionComplete(question: Question): boolean {
  const hasPrompt = Boolean(question.prompt.trim() || question.promptHtml.trim());
  const hasAnswer = Boolean(question.answer.trim());
  const hasCorrectOptions = question.responseType !== "MCQ" || question.options.length >= 2;
  return hasPrompt && hasAnswer && questionHasSolution(question) && hasCorrectOptions && Boolean(topicBucket(question));
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
