"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Flag, Grid2X2, LoaderCircle, LockKeyhole, Send, Timer, X } from "lucide-react";
import type { AttemptEvent, Difficulty, ResponseType } from "@/lib/domain";

type Choice = { id: string; text: string };
type TestQuestion = { id: string; prompt: string; promptHtml: string; options: Choice[]; pillar: string; topic: string; area: string; difficulty: Difficulty; responseType: ResponseType };
type TestData = { attempt: { id: string; status: string; started_at: string; answers: Record<string, string>; solution_opened: string[] }; sectional: { id: string; title: string; duration_seconds: number }; questions: TestQuestion[]; events: Array<{ event_type: string; question_id: string; created_at: string; value: unknown }> };

function makeEvent(type: AttemptEvent["type"], questionId?: string, durationSeconds?: number, active?: boolean, value?: string | boolean, metadata?: AttemptEvent["metadata"]): AttemptEvent {
  return { id: crypto.randomUUID(), type, questionId, at: new Date().toISOString(), durationSeconds, active, value, metadata };
}
function formatTime(seconds: number) { const safe = Math.max(0, seconds); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }

export function TestRunner({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [data, setData] = useState<TestData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(2400);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const eventsRef = useRef<AttemptEvent[]>([]);
  const answersRef = useRef<Record<string, string>>({});
  const lastOpenedAt = useRef<number | null>(null);
  const lastQuestionId = useRef<string | null>(null);
  const submitting = useRef(false);

  const push = (item: AttemptEvent) => { eventsRef.current.push(item); setRevision((value) => value + 1); };
  const flush = useCallback(async (answersOverride?: Record<string, string>, final = false) => {
    if (!data) return;
    const batch = eventsRef.current.splice(0);
    setSaving(true);
    try {
      const response = await fetch(`/api/attempts/${attemptId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: answersOverride ?? answersRef.current, events: batch }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Autosave failed.");
      setError("");
    } catch (cause) {
      eventsRef.current.unshift(...batch);
      setError(cause instanceof Error ? cause.message : "Autosave failed.");
      if (final) throw cause;
    } finally { setSaving(false); }
  }, [attemptId, data]);
  const leaveCurrent = useCallback((pause = false) => {
    if (!data || !lastQuestionId.current || lastOpenedAt.current === null) return;
    const elapsed = Math.max(0, Math.round((Date.now() - lastOpenedAt.current) / 1000));
    push(makeEvent("question_left", lastQuestionId.current, elapsed, true, undefined, pause ? { pause: true } : { visitClosed: true }));
    lastOpenedAt.current = null; lastQuestionId.current = null;
  }, [data]);
  const openCurrent = useCallback((index: number) => {
    if (!data) return;
    const question = data.questions[index];
    if (!question) return;
    push(makeEvent("question_opened", question.id));
    lastQuestionId.current = question.id; lastOpenedAt.current = Date.now();
  }, [data]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/attempts/${attemptId}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load this attempt.");
        if (!alive) return;
        if (result.attempt.status === "submitted") { router.replace(`/analysis/${attemptId}`); return; }
        setData(result);
        const savedAnswers = result.attempt.answers ?? {};
        answersRef.current = savedAnswers; setAnswers(savedAnswers);
        const marked: Record<string, boolean> = {};
        for (const item of result.events ?? []) {
          if (item.event_type === "review_marked") marked[item.question_id] = true;
          if (item.event_type === "review_unmarked") marked[item.question_id] = false;
        }
        setReview(marked);
        const deadline = new Date(result.attempt.started_at).getTime() + result.sectional.duration_seconds * 1000;
        setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        const firstQuestion = result.questions[0];
        if (firstQuestion) {
          eventsRef.current.push(makeEvent("question_opened", firstQuestion.id));
          lastQuestionId.current = firstQuestion.id; lastOpenedAt.current = Date.now(); setRevision((value) => value + 1);
        }
        setLoading(false);
      } catch (cause) {
        if (alive) { setError(cause instanceof Error ? cause.message : "Could not load attempt."); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [attemptId, router]);

  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => {
      const deadline = new Date(data.attempt.started_at).getTime() + data.sectional.duration_seconds * 1000;
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submitAttempt();
    }, 500);
    return () => window.clearInterval(timer);
    // The deadline is fixed at attempt creation; answers are read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!data || revision === 0) return;
    const timeout = window.setTimeout(() => void flush(), 900);
    return () => window.clearTimeout(timeout);
  }, [data, revision, flush]);

  useEffect(() => {
    if (!data) return;
    const checkpoint = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !lastQuestionId.current || lastOpenedAt.current === null) return;
      const elapsed = Math.max(0, Math.round((Date.now() - lastOpenedAt.current) / 1000));
      if (elapsed < 1) return;
      push(makeEvent("question_left", lastQuestionId.current, elapsed, true, undefined, { checkpoint: true }));
      lastOpenedAt.current = Date.now();
    }, 10000);
    return () => window.clearInterval(checkpoint);
  }, [data]);

  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        leaveCurrent(true); push(makeEvent("focus_changed", undefined, undefined, false, false));
      } else if (data) {
        push(makeEvent("focus_changed", undefined, undefined, true, true));
        const question = data.questions[current];
        if (question) { lastQuestionId.current = question.id; lastOpenedAt.current = Date.now(); }
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [data, current, leaveCurrent]);

  const question = data?.questions[current];
  const answeredCount = useMemo(() => Object.values(answers).filter((answer) => String(answer).trim()).length, [answers]);
  async function submitAttempt() {
    if (!data || submitting.current) return;
    submitting.current = true; setConfirm(false); leaveCurrent();
    try {
      await flush(answersRef.current, true);
      const response = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit attempt.");
      router.replace(`/analysis/${attemptId}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit."); submitting.current = false; }
  }
  function changeAnswer(value: string) {
    if (!question) return;
    const next = { ...answersRef.current, [question.id]: value };
    answersRef.current = next; setAnswers(next);
    push(makeEvent(value ? "answer_changed" : "answer_cleared", question.id, undefined, undefined, value));
  }
  function toggleReview() {
    if (!question) return;
    const next = !review[question.id]; setReview((currentReview) => ({ ...currentReview, [question.id]: next }));
    push(makeEvent(next ? "review_marked" : "review_unmarked", question.id, undefined, undefined, next));
  }
  function goTo(index: number) {
    if (!data || index === current || index < 0 || index >= data.questions.length) return;
    leaveCurrent(); setCurrent(index); openCurrent(index);
  }

  if (loading) return <div className="test-loading"><LoaderCircle className="spin" size={22}/><span>Restoring your saved attempt…</span></div>;
  if (!data || !question) return <div className="page-content"><div className="error-message"><CircleAlert size={16}/>{error || "This attempt could not be loaded."}</div></div>;
  const remainingLabel = remaining <= 300 ? "timer-urgent" : "";
  return <div className="test-screen"><header className="test-header"><div className="test-brand"><span className="brand-mark"><Timer size={18}/></span><div><b>{data.sectional.title}</b><small>QUANTITATIVE ABILITY · 22 QUESTIONS</small></div></div><div className={`test-clock ${remainingLabel}`}><Timer size={17}/><span>{formatTime(remaining)}</span><small>REMAINING</small></div><div className="test-save-state">{saving ? <><LoaderCircle className="spin" size={14}/>Saving</> : <><Check size={14}/>Saved</>}</div><button className="button button-submit" onClick={() => setConfirm(true)}><Send size={14}/>Submit section</button></header>
    <div className="test-progress"><span style={{ width: `${Math.round((answeredCount / 22) * 100)}%` }}/></div><div className="test-layout"><main className="question-panel"><div className="question-topline"><span className="question-counter">QUESTION <b>{String(current + 1).padStart(2, "0")}</b><i>/ 22</i></span><div className="question-tags"><span className={`difficulty-badge ${question.difficulty === "A" ? "mint" : question.difficulty === "B" ? "blue" : "coral"}`}>{question.difficulty}</span><span>{question.topic || question.pillar || "Quantitative Ability"}</span>{question.responseType === "TITA" && <span className="type-tag">NUMERIC ENTRY</span>}</div></div><div className="question-prompt">{question.promptHtml ? <div dangerouslySetInnerHTML={{ __html: question.promptHtml }}/> : <p>{question.prompt}</p>}</div>
      <div className="answer-area">{question.responseType === "MCQ" ? <div className="choice-list">{question.options.map((choice) => <button key={choice.id} className={`choice-option ${answers[question.id] === choice.id ? "selected" : ""}`} onClick={() => changeAnswer(choice.id)}><span className="choice-key">{choice.id}</span><span>{choice.text}</span>{answers[question.id] === choice.id && <Check size={16}/>}</button>)}</div> : <label className="tita-field"><span>Your answer</span><input inputMode="decimal" value={answers[question.id] ?? ""} onChange={(event) => changeAnswer(event.target.value)} placeholder="Enter a number"/><small>Use digits; commas and surrounding spaces are ignored.</small></label>}</div>
      <div className="question-actions"><button className={`review-button ${review[question.id] ? "marked" : ""}`} onClick={toggleReview}><Flag size={15}/>{review[question.id] ? "Marked for review" : "Mark for review"}</button><span className="answer-state">{answers[question.id]?.trim() ? "Answer saved" : "Not answered"}</span></div><div className="question-footer"><button className="button button-secondary" onClick={() => goTo(current - 1)} disabled={current === 0}><ArrowLeft size={15}/>Previous</button><div className="question-footer-center"><span>{answeredCount} of 22 answered</span><button className="text-button" onClick={() => goTo(21)}>Go to last <ArrowRight size={13}/></button></div><button className="button button-dark" onClick={() => goTo(current + 1)} disabled={current === 21}>Next question<ArrowRight size={15}/></button></div>
    </main><aside className="test-nav-panel"><div className="test-nav-heading"><div><span className="panel-kicker">QUESTION MAP</span><h2>All questions</h2></div><Grid2X2 size={17}/></div><div className="question-map">{data.questions.map((item, index) => <button key={item.id} aria-label={`Question ${index + 1}${answers[item.id] ? ", answered" : ""}${review[item.id] ? ", marked for review" : ""}`} className={`map-question ${index === current ? "current" : ""} ${answers[item.id]?.trim() ? "answered" : ""} ${review[item.id] ? "reviewed" : ""}`} onClick={() => goTo(index)}>{String(index + 1).padStart(2, "0")}{review[item.id] && <Flag size={10}/>}</button>)}</div><div className="map-legend"><span><i className="legend-dot answered-dot"/>Answered</span><span><i className="legend-dot review-dot"/>Review</span><span><i className="legend-dot"/>Unseen / blank</span></div><button className="submit-outline" onClick={() => setConfirm(true)}><Send size={14}/>Review and submit</button><div className="test-integrity"><LockKeyhole size={14}/><span>Your answers and progress are visible only to you.</span></div></aside></div>
    {error && <div className="toast-error"><CircleAlert size={15}/>{error}<button onClick={() => setError("")}><X size={14}/></button></div>}
    {confirm && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-heading"><button className="modal-close" aria-label="Close" onClick={() => setConfirm(false)}><X size={17}/></button><div className="modal-icon"><Send size={19}/></div><span className="panel-kicker">END YOUR SITTING</span><h2 id="submit-heading">Ready to submit?</h2><p>Your answers will be scored and your personal report will be available immediately.</p><div className="submit-summary"><span>{answeredCount} answered</span><span>{22 - answeredCount} blank</span><span>{Object.values(review).filter(Boolean).length} for review</span></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setConfirm(false)}>Keep working</button><button className="button button-dark" onClick={() => void submitAttempt()} disabled={submitting.current}>Submit now<ArrowRight size={15}/></button></div><small>Submissions cannot be changed. The timer submits automatically at zero.</small></section></div>}
  </div>;
}
