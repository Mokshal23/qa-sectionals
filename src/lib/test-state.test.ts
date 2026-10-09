import { describe, expect, it } from "vitest";
import { resumeQuestionIndex } from "./test-state";

describe("attempt resume position", () => {
  it("restores the most recently opened question from saved events", () => {
    const events = [
      { event_type: "question_opened", question_id: "q1", created_at: "2026-10-09T10:00:00.000Z" },
      { event_type: "question_opened", question_id: "q2", created_at: "2026-10-09T10:03:00.000Z" },
      { event_type: "question_opened", question_id: "q1", created_at: "2026-10-09T10:04:00.000Z" },
    ];
    expect(resumeQuestionIndex(["q1", "q2", "q3"], events)).toBe(0);
  });

  it("ignores unrelated or stale question events and starts at the beginning without history", () => {
    const events = [
      { event_type: "question_opened", question_id: "removed", created_at: "2026-10-09T10:00:00.000Z" },
      { event_type: "answer_changed", question_id: "q2", created_at: "2026-10-09T10:01:00.000Z" },
    ];
    expect(resumeQuestionIndex(["q1", "q2"], events)).toBe(0);
    expect(resumeQuestionIndex(["q1", "q2"], [])).toBe(0);
  });
});
