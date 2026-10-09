import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeAttempt } from "@/lib/analytics";
import type { AttemptEvent, AttemptRecord, Question } from "@/lib/domain";
import { safeQuestionHtml } from "@/lib/sanitize";
import { topicBucket } from "@/lib/domain";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data: attempt, error } = await auth.supabase.from("attempts").select("*").eq("id", id).maybeSingle();
  if (error || !attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  const [{ data: sectional }, { data: links }, { data: events }] = await Promise.all([
    auth.supabase.from("sectionals").select("id,title,duration_seconds").eq("id", attempt.sectional_id).single(),
    auth.supabase.from("sectional_questions").select("question_id,position").eq("sectional_id", attempt.sectional_id).order("position"),
    auth.supabase.from("attempt_events").select("*").eq("attempt_id", id).order("created_at"),
  ]);
  const ids = (links ?? []).map((link) => link.question_id);
  const { data: questionRows } = await auth.supabase.from("question_catalog").select("*").in("id", ids);
  const orderedQuestions = ids.map((questionId) => questionRows?.find((question) => question.id === questionId)).filter(Boolean);
  const publicQuestions = orderedQuestions.map((row) => ({
    id: row.id, prompt: row.prompt, promptHtml: safeQuestionHtml(row.prompt_html ?? ""),
    options: row.options, pillar: row.pillar, topic: row.topic, area: row.area,
    difficulty: row.difficulty, responseType: row.response_type,
    pValue: row.p_value === null ? null : Number(row.p_value), pValueUnit: row.p_value_unit,
  }));
  let report = null;
  let reportQuestions = null;
  let personalBaseline: { historyAttempts: number; secondsPerQuestion: number; topicSecondsPerQuestion: Record<string, number> } | null = null;
  if (attempt.status === "submitted") {
    const admin = createSupabaseAdminClient();
    const { data: keyRows } = await admin.from("question_solutions").select("question_id,answer,solution,solution_html").in("question_id", ids);
    const complete = orderedQuestions.map((row) => {
      const key = keyRows?.find((candidate) => candidate.question_id === row.id);
      return {
        id: row.id, prompt: row.prompt, promptHtml: row.prompt_html, options: row.options,
        pillar: row.pillar, topic: row.topic, area: row.area, difficulty: row.difficulty,
        responseType: row.response_type, pValue: row.p_value === null ? null : Number(row.p_value),
        pValueUnit: row.p_value_unit,
        answer: key?.answer ?? "", solution: key?.solution ?? "", solutionHtml: key?.solution_html ?? "",
        hasSolution: Boolean(key?.solution?.trim() || key?.solution_html?.trim()),
      };
    }) as unknown as Question[];
    const attemptRecord: AttemptRecord = {
      id: attempt.id, userId: attempt.owner_id, sectionalId: attempt.sectional_id,
      startedAt: attempt.started_at, submittedAt: attempt.submitted_at,
      answers: attempt.answers ?? {}, retryAnswers: attempt.retry_answers ?? {},
      mistakeLabels: attempt.mistake_labels ?? {}, solutionOpened: attempt.solution_opened ?? [],
      events: (events ?? []).map((event) => ({ id: event.id, type: event.event_type, questionId: event.question_id, at: event.created_at, durationSeconds: event.duration_seconds, active: event.active, value: typeof event.value === "string" || typeof event.value === "boolean" ? event.value : undefined, metadata: event.metadata ?? {} })) as AttemptEvent[],
    };
    report = analyzeAttempt(complete, attemptRecord);
    reportQuestions = complete.map((question) => ({ ...question, promptHtml: safeQuestionHtml(question.promptHtml), solutionHtml: safeQuestionHtml(question.solutionHtml) }));
    const { data: history } = await auth.supabase.from("attempts").select("id,sectional_id,submitted_at").eq("status", "submitted").lt("submitted_at", attempt.submitted_at).order("submitted_at", { ascending: false }).limit(10);
    if ((history ?? []).length >= 3) {
      const historyParts = await Promise.all((history ?? []).map(async (previous) => {
        const [{ data: previousEvents }, { data: previousLinks }] = await Promise.all([
          auth.supabase.from("attempt_events").select("question_id,duration_seconds,active,event_type").eq("attempt_id", previous.id),
          auth.supabase.from("sectional_questions").select("question_id").eq("sectional_id", previous.sectional_id),
        ]);
        return { id: previous.id, events: previousEvents ?? [], questionIds: (previousLinks ?? []).map((link) => link.question_id) };
      }));
      const historicalQuestionIds = [...new Set(historyParts.flatMap((part) => part.questionIds))];
      const { data: historicalQuestions } = await auth.supabase.from("question_catalog").select("id,pillar,topic,area").in("id", historicalQuestionIds);
      const historicalBuckets = new Map((historicalQuestions ?? []).map((question) => [question.id, topicBucket({ pillar: question.pillar, topic: question.topic, area: question.area }) ?? "Unclassified"]));
      const perAttemptPaces: number[] = [];
      const topicPaces = new Map<string, number[]>();
      for (const part of historyParts) {
        let totalSeconds = 0;
        const topicSeconds = new Map<string, number>();
        const topicCounts = new Map<string, number>();
        for (const questionId of part.questionIds) {
          const bucket = historicalBuckets.get(questionId) ?? "Unclassified";
          topicCounts.set(bucket, (topicCounts.get(bucket) ?? 0) + 1);
        }
        for (const event of part.events) {
          if (event.event_type !== "question_left" || event.active === false || !event.question_id) continue;
          const seconds = Math.max(0, Number(event.duration_seconds ?? 0));
          const bucket = historicalBuckets.get(event.question_id) ?? "Unclassified";
          totalSeconds += seconds;
          topicSeconds.set(bucket, (topicSeconds.get(bucket) ?? 0) + seconds);
        }
        perAttemptPaces.push(totalSeconds / Math.max(1, part.questionIds.length));
        for (const [bucket, count] of topicCounts) {
          if (count < 1) continue;
          const values = topicPaces.get(bucket) ?? [];
          values.push((topicSeconds.get(bucket) ?? 0) / count);
          topicPaces.set(bucket, values);
        }
      }
      personalBaseline = {
        historyAttempts: historyParts.length,
        secondsPerQuestion: median(perAttemptPaces),
        topicSecondsPerQuestion: Object.fromEntries([...topicPaces.entries()].filter(([, values]) => values.length >= 3).map(([topic, values]) => [topic, median(values)])),
      };
    }
  }
  return NextResponse.json({ attempt, sectional, questions: publicQuestions, events: events ?? [], report, reportQuestions, personalBaseline });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json() as { answers?: Record<string, string>; retryAnswers?: Record<string, string>; mistakeLabels?: Record<string, string>; solutionOpened?: string[]; events?: Array<Record<string, unknown>> };
  const { data: attempt, error: fetchError } = await auth.supabase.from("attempts").select("id,status,sectional_id").eq("id", id).maybeSingle();
  if (fetchError || !attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "in_progress") return NextResponse.json({ error: "This attempt is already submitted." }, { status: 409 });
  const updates = {
    ...(body.answers ? { answers: body.answers } : {}),
    ...(body.retryAnswers ? { retry_answers: body.retryAnswers } : {}),
    ...(body.mistakeLabels ? { mistake_labels: body.mistakeLabels } : {}),
    ...(body.solutionOpened ? { solution_opened: body.solutionOpened } : {}),
  };
  if (Object.keys(updates).length) {
    const { error } = await auth.supabase.from("attempts").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.events?.length) {
    const allowed = new Set(["question_opened", "question_left", "answer_changed", "answer_cleared", "review_marked", "review_unmarked", "focus_changed", "retry_answered", "solution_opened", "mistake_labeled"]);
    const rows = body.events.filter((event) => typeof event.id === "string" && allowed.has(String(event.type))).map((event) => ({
      id: event.id, attempt_id: id, owner_id: auth.user.id, event_type: event.type,
      question_id: event.questionId ?? null, created_at: event.at,
      duration_seconds: event.durationSeconds ?? null, active: event.active ?? null,
      value: event.value === undefined ? null : event.value, metadata: event.metadata ?? {},
    }));
    if (rows.length) {
      const { error } = await auth.supabase.from("attempt_events").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
