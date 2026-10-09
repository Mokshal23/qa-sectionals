import { AttemptRecord, Question, scoreQuestion, topicBucket } from "./domain";
import { retryPotential } from "./scoring";

export type QuestionAnalysis = {
  questionId: string;
  status: "correct" | "incorrect" | "blank";
  marks: number;
  answer: string;
  timeSeconds: number;
  visits: number;
  glances: number;
  answerChanges: number;
  markedForReview: boolean;
  everOpened: boolean;
  retryAttempted: boolean;
  retryCorrectBeforeSolution: boolean;
  mistakeLabel: string | null;
};

export function analyzeAttempt(questions: Question[], attempt: AttemptRecord) {
  const items = new Map<string, QuestionAnalysis>();
  const solutionOpened = new Set(attempt.solutionOpened);
  const retryAnswers: Record<string, { answer: string; answeredAt: string; solutionWasOpen: boolean }> = {};
  for (const question of questions) {
    const scored = scoreQuestion(question, attempt.answers[question.id] ?? "");
    items.set(question.id, {
      questionId: question.id,
      status: scored.status,
      marks: scored.marks,
      answer: attempt.answers[question.id] ?? "",
      timeSeconds: 0,
      visits: 0,
      glances: 0,
      answerChanges: 0,
      markedForReview: false,
      everOpened: false,
      retryAttempted: false,
      retryCorrectBeforeSolution: false,
      mistakeLabel: attempt.mistakeLabels[question.id] ?? null,
    });
  }

  const events = [...attempt.events].sort((left, right) => left.at.localeCompare(right.at));
  const activeVisitSeconds = new Map<string, number>();
  for (const event of events) {
    if (!event.questionId) continue;
    const item = items.get(event.questionId);
    if (!item) continue;
    if (event.type === "question_opened") {
      item.visits += 1;
      item.everOpened = true;
      activeVisitSeconds.set(event.questionId, 0);
    } else if (event.type === "question_left") {
      const seconds = Math.max(0, Number(event.durationSeconds ?? 0));
      if (event.active !== false) {
        item.timeSeconds += seconds;
        activeVisitSeconds.set(event.questionId, (activeVisitSeconds.get(event.questionId) ?? 0) + seconds);
      }
      if (event.metadata?.checkpoint === true || event.metadata?.pause === true) continue;
      if ((activeVisitSeconds.get(event.questionId) ?? seconds) < 7) item.glances += 1;
      activeVisitSeconds.delete(event.questionId);
    } else if (event.type === "answer_changed") {
      item.answerChanges += 1;
    } else if (event.type === "review_marked") {
      item.markedForReview = true;
    } else if (event.type === "review_unmarked") {
      item.markedForReview = false;
    } else if (event.type === "solution_opened") {
      solutionOpened.add(event.questionId);
    } else if (event.type === "retry_answered" && event.value !== undefined) {
      item.retryAttempted = true;
      retryAnswers[event.questionId] = {
        answer: String(event.value),
        answeredAt: event.at,
        solutionWasOpen: solutionOpened.has(event.questionId) || event.metadata?.solutionWasOpen === true || event.metadata?.solutionWasOpen === "true",
      };
    }
  }

  for (const question of questions) {
    const item = items.get(question.id)!;
    const retry = retryAnswers[question.id];
    if (retry && !retry.solutionWasOpen && scoreQuestion(question, retry.answer).status === "correct") {
      item.retryCorrectBeforeSolution = true;
    }
  }

  const analyzed = questions.map((question) => ({ question, analysis: items.get(question.id)! }));
  const total = analyzed.length;
  const actualScore = analyzed.reduce((sum, row) => sum + row.analysis.marks, 0);
  const correct = analyzed.filter((row) => row.analysis.status === "correct").length;
  const incorrect = analyzed.filter((row) => row.analysis.status === "incorrect").length;
  const blank = analyzed.filter((row) => row.analysis.status === "blank").length;
  const timeSeconds = analyzed.reduce((sum, row) => sum + row.analysis.timeSeconds, 0);
  const retryRecord = Object.fromEntries(Object.entries(retryAnswers).map(([id, value]) => [id, value]));
  const potential = retryPotential(questions, attempt.answers, retryRecord);

  const topicBreakdown = Object.fromEntries([...new Set(analyzed.map(({ question }) => topicBucket(question) ?? "Unclassified"))].map((topic) => {
    const group = analyzed.filter(({ question }) => (topicBucket(question) ?? "Unclassified") === topic);
    return [topic, {
      count: group.length,
      correct: group.filter(({ analysis }) => analysis.status === "correct").length,
      incorrect: group.filter(({ analysis }) => analysis.status === "incorrect").length,
      blank: group.filter(({ analysis }) => analysis.status === "blank").length,
      timeSeconds: group.reduce((sum, { analysis }) => sum + analysis.timeSeconds, 0),
      score: group.reduce((sum, { analysis }) => sum + analysis.marks, 0),
    }];
  }));
  const difficultyBreakdown = Object.fromEntries(["A", "B", "C"].map((difficulty) => {
    const group = analyzed.filter(({ question }) => question.difficulty === difficulty);
    return [difficulty, {
      count: group.length,
      correct: group.filter(({ analysis }) => analysis.status === "correct").length,
      incorrect: group.filter(({ analysis }) => analysis.status === "incorrect").length,
      blank: group.filter(({ analysis }) => analysis.status === "blank").length,
      timeSeconds: group.reduce((sum, { analysis }) => sum + analysis.timeSeconds, 0),
      score: group.reduce((sum, { analysis }) => sum + analysis.marks, 0),
    }];
  }));
  const firstPassOrder = events.filter((event) => event.type === "question_opened" && event.questionId).map((event) => event.questionId!);
  const seenFirst = new Set<string>();
  const uniqueFirstPassOrder = firstPassOrder.filter((id) => (seenFirst.has(id) ? false : (seenFirst.add(id), true)));
  const missedAccessible = analyzed.filter(({ question, analysis }) => question.difficulty !== "C" && analysis.status !== "correct").length;
  const insights: { title: string; detail: string; evidenceQuestionIds: string[]; severity: "focus" | "watch" | "positive" }[] = [];
  if (missedAccessible > 0) {
    const ids = analyzed.filter(({ question, analysis }) => question.difficulty !== "C" && analysis.status !== "correct").map(({ question }) => question.id);
    insights.push({ title: "Protect the easier marks", detail: `${missedAccessible} A/B question${missedAccessible === 1 ? "" : "s"} was missed or left blank. Review these before spending more time on difficult questions.`, evidenceQuestionIds: ids, severity: "focus" });
  }
  for (const [topic, stats] of Object.entries(topicBreakdown) as [string, (typeof topicBreakdown)[string]][]) {
    const attempted = stats.correct + stats.incorrect;
    if (attempted >= 3 && stats.correct / attempted < 0.5) {
      const ids = analyzed.filter(({ question, analysis }) => (topicBucket(question) ?? "Unclassified") === topic && analysis.status !== "correct").map(({ question }) => question.id);
      insights.push({ title: `Review ${topic}`, detail: `${stats.correct} of ${attempted} attempted questions were correct in this area.`, evidenceQuestionIds: ids, severity: "focus" });
    }
  }
  const overlongMisses = analyzed.filter(({ analysis }) => analysis.status !== "correct" && analysis.timeSeconds > 2 * (40 * 60 / Math.max(1, total)));
  if (overlongMisses.length) {
    insights.push({ title: "Watch time on unresolved questions", detail: `${overlongMisses.length} missed question${overlongMisses.length === 1 ? "" : "s"} used more than twice the average section pace.`, evidenceQuestionIds: overlongMisses.map(({ question }) => question.id), severity: "watch" });
  }
  const recoverable = analyzed.filter(({ analysis }) => analysis.retryCorrectBeforeSolution);
  if (recoverable.length) {
    insights.push({ title: "Recoverable marks found", detail: `You solved ${recoverable.length} missed question${recoverable.length === 1 ? "" : "s"} on a timed retry before opening the solution.`, evidenceQuestionIds: recoverable.map(({ question }) => question.id), severity: "positive" });
  }
  if (!insights.length) insights.push({ title: "Build your personal baseline", detail: "Complete another sectional to make topic and pacing patterns more reliable.", evidenceQuestionIds: [], severity: "positive" });

  const mistakeBreakdown = Object.fromEntries(["concept", "decision", "execution", "focus", "other"].map((label) => [label, analyzed.filter(({ analysis }) => analysis.mistakeLabel === label).length]));
  return {
    questionCount: total,
    score: actualScore,
    maximumScore: total * 3,
    correct,
    incorrect,
    blank,
    accuracy: correct + incorrect ? correct / (correct + incorrect) : 0,
    timeSeconds,
    averageQuestionSeconds: total ? timeSeconds / total : 0,
    questions: Object.fromEntries(analyzed.map(({ question, analysis }) => [question.id, analysis])),
    topicBreakdown,
    difficultyBreakdown,
    firstPassOrder: uniqueFirstPassOrder,
    markedForReviewCount: analyzed.filter(({ analysis }) => analysis.markedForReview).length,
    revisitedCount: analyzed.filter(({ analysis }) => analysis.visits > 1).length,
    glanceCount: analyzed.reduce((sum, { analysis }) => sum + analysis.glances, 0),
    answerChangeCount: analyzed.reduce((sum, { analysis }) => sum + analysis.answerChanges, 0),
    potential,
    mistakeBreakdown,
    insights: insights.sort((left, right) => ({ focus: 0, watch: 1, positive: 2 }[left.severity] - { focus: 0, watch: 1, positive: 2 }[right.severity])),
  };
}
