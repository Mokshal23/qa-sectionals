import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scoreQuestion } from "@/lib/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json() as { questionId?: string; answer?: string; durationSeconds?: number };
  if (!body.questionId || typeof body.answer !== "string" || !body.answer.trim()) return NextResponse.json({ error: "Add a retry answer." }, { status: 400 });
  const { data: attempt, error } = await auth.supabase.from("attempts").select("id,status,sectional_id,answers,solution_opened,retry_answers").eq("id", id).maybeSingle();
  if (error || !attempt || attempt.status !== "submitted") return NextResponse.json({ error: "Submitted attempt not found." }, { status: 404 });
  if (attempt.retry_answers?.[body.questionId]) return NextResponse.json({ error: "A retry has already been recorded for this question." }, { status: 409 });
  if (Number(body.durationSeconds ?? 0) > 180) return NextResponse.json({ error: "The timed retry window has expired." }, { status: 400 });
  const { data: link } = await auth.supabase.from("sectional_questions").select("question_id").eq("sectional_id", attempt.sectional_id).eq("question_id", body.questionId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Question is not part of this attempt." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const [{ data: question }, { data: key }] = await Promise.all([
    auth.supabase.from("question_catalog").select("id,response_type").eq("id", body.questionId).single(),
    admin.from("question_solutions").select("answer").eq("question_id", body.questionId).single(),
  ]);
  if (!question || !key) return NextResponse.json({ error: "Question answer key is unavailable." }, { status: 500 });
  const scored = scoreQuestion({ id: question.id, responseType: question.response_type, answer: key.answer } as Parameters<typeof scoreQuestion>[0], body.answer);
  const solutionWasOpen = (attempt.solution_opened ?? []).includes(body.questionId);
  const answeredAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Number(body.durationSeconds ?? 0));
  const retryAnswers = { ...(attempt.retry_answers ?? {}), [body.questionId]: { answer: body.answer, answeredAt, solutionWasOpen, durationSeconds } };
  const { error: updateError } = await auth.supabase.from("attempts").update({ retry_answers: retryAnswers }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const { error: eventError } = await auth.supabase.from("attempt_events").insert({ id: crypto.randomUUID(), attempt_id: id, owner_id: auth.user.id, event_type: "retry_answered", question_id: body.questionId, created_at: answeredAt, duration_seconds: durationSeconds, active: true, value: body.answer, metadata: { solutionWasOpen, preSolution: !solutionWasOpen } });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  return NextResponse.json({ correct: scored.status === "correct", withinReach: scored.status === "correct" && !solutionWasOpen, durationSeconds });
}
