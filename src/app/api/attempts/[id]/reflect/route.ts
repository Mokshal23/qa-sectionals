import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json() as { questionId?: string; action?: string; value?: string };
  if (!body.questionId || !["solution_opened", "mistake_labeled"].includes(body.action ?? "")) return NextResponse.json({ error: "Reflection update is invalid." }, { status: 400 });
  const { data: attempt, error } = await auth.supabase.from("attempts").select("status,sectional_id,solution_opened,mistake_labels").eq("id", id).maybeSingle();
  if (error || !attempt || attempt.status !== "submitted") return NextResponse.json({ error: "Submitted attempt not found." }, { status: 404 });
  const { data: link } = await auth.supabase.from("sectional_questions").select("question_id").eq("sectional_id", attempt.sectional_id).eq("question_id", body.questionId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Question is not part of this attempt." }, { status: 400 });
  const labels = new Set(["concept", "decision", "execution", "focus", "other"]);
  const now = new Date().toISOString();
  let updates: Record<string, unknown> = {};
  let value: string | null = null;
  if (body.action === "solution_opened") {
    const opened = new Set<string>(attempt.solution_opened ?? []);
    opened.add(body.questionId);
    updates = { solution_opened: [...opened] };
    value = "true";
  } else {
    if (!body.value || !labels.has(body.value)) return NextResponse.json({ error: "Choose a valid mistake label." }, { status: 400 });
    updates = { mistake_labels: { ...(attempt.mistake_labels ?? {}), [body.questionId]: body.value } };
    value = body.value;
  }
  const { error: updateError } = await auth.supabase.from("attempts").update(updates).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const { error: eventError } = await auth.supabase.from("attempt_events").insert({ id: crypto.randomUUID(), attempt_id: id, owner_id: auth.user.id, event_type: body.action, question_id: body.questionId, created_at: now, active: true, value, metadata: {} });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
