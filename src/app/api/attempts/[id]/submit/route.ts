import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scoreQuestion } from "@/lib/domain";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data: attempt, error } = await auth.supabase.from("attempts").select("*").eq("id", id).maybeSingle();
  if (error || !attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status === "submitted") return NextResponse.json({ ok: true, alreadySubmitted: true });
  const [{ data: sectional }, { data: links }] = await Promise.all([
    auth.supabase.from("sectionals").select("duration_seconds").eq("id", attempt.sectional_id).single(),
    auth.supabase.from("sectional_questions").select("question_id").eq("sectional_id", attempt.sectional_id),
  ]);
  const ids = (links ?? []).map((link) => link.question_id);
  const admin = createSupabaseAdminClient();
  const { data: keyRows } = await admin.from("question_solutions").select("question_id,answer").in("question_id", ids);
  const { data: bankRows } = await auth.supabase.from("question_catalog").select("id,response_type").in("id", ids);
  const score = { score: 0, correct: 0, incorrect: 0, blank: 0, maximumScore: ids.length * 3 };
  for (const row of bankRows ?? []) {
    const answerKey = keyRows?.find((candidate) => candidate.question_id === row.id)?.answer ?? "";
    const question = { id: row.id, responseType: row.response_type, answer: answerKey } as Parameters<typeof scoreQuestion>[0];
    const result = scoreQuestion(question, attempt.answers?.[row.id] ?? "");
    score.score += result.marks;
    score[result.status] += 1;
  }
  const expiredAt = new Date(new Date(attempt.started_at).getTime() + Number(sectional?.duration_seconds ?? 2400) * 1000);
  const submittedAt = new Date(Math.min(Date.now(), expiredAt.getTime())).toISOString();
  const { error: updateError } = await admin.from("attempts").update({ status: "submitted", submitted_at: submittedAt, score }).eq("id", id).eq("owner_id", auth.user.id).eq("status", "in_progress");
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, score });
}
