export type SavedAttemptEvent = {
  event_type: string;
  question_id: string | null;
  created_at: string;
};

export function resumeQuestionIndex(questionIds: string[], events: SavedAttemptEvent[]): number {
  const available = new Set(questionIds);
  let latest: SavedAttemptEvent | null = null;
  for (const event of events) {
    if (event.event_type !== "question_opened" || !event.question_id || !available.has(event.question_id)) continue;
    if (!latest || event.created_at >= latest.created_at) latest = event;
  }
  return latest ? Math.max(0, questionIds.indexOf(latest.question_id!)) : 0;
}
