import { NextResponse } from "next/server";
import { getOwnerApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Question } from "@/lib/domain";
import { validateQuestionImport } from "@/lib/import";

export async function GET() {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const admin = createSupabaseAdminClient();
  const [{ data: rows, error }, { data: keys, error: keyError }] = await Promise.all([
    admin.from("question_catalog").select("id,difficulty,response_type,topic,pillar,area,has_solution,p_value"),
    admin.from("question_solutions").select("question_id,answer,solution,solution_html"),
  ]);
  if (error || keyError) return NextResponse.json({ error: error?.message ?? keyError?.message }, { status: 500 });
  const difficultyCounts = { A: 0, B: 0, C: 0 };
  const readyCounts = { A: 0, B: 0, C: 0 };
  const solutionIds = new Set((keys ?? []).filter((key) => Boolean(key.answer?.trim() && (key.solution?.trim() || key.solution_html?.trim()))).map((key) => key.question_id));
  for (const row of rows ?? []) {
    difficultyCounts[row.difficulty as "A" | "B" | "C"] += 1;
    if (solutionIds.has(row.id) && (row.topic || row.pillar || row.area)) readyCounts[row.difficulty as "A" | "B" | "C"] += 1;
  }
  return NextResponse.json({ total: rows?.length ?? 0, difficultyCounts, readyCounts, withPValue: (rows ?? []).filter((row) => row.p_value !== null).length });
}

export async function POST(request: Request) {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const { questions } = await request.json() as { questions?: Question[] };
  if (!Array.isArray(questions) || !questions.length || questions.length > 100) return NextResponse.json({ error: "Send between 1 and 100 questions per batch." }, { status: 400 });
  const issues = validateQuestionImport(questions).filter((issue) => issue.severity === "error");
  if (issues.length) return NextResponse.json({ error: `Question validation failed: ${issues.slice(0, 4).map((issue) => `row ${issue.row}: ${issue.message}`).join("; ")}` }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: usedRows, error: usedError } = await admin.from("sectional_questions").select("question_id");
  if (usedError) return NextResponse.json({ error: usedError.message }, { status: 500 });
  const frozenIds = new Set((usedRows ?? []).map((row) => row.question_id));
  const editableQuestions = questions.filter((question) => !frozenIds.has(question.id));
  const frozenQuestions = questions.filter((question) => frozenIds.has(question.id));
  if (frozenQuestions.length) {
    // Published forms keep their prompts, keys, and solutions fixed. Choice display
    // metadata can be repaired in place so existing tests render their source assets.
    const { error: repairError } = await admin.from("question_catalog").upsert(frozenQuestions.map(({ id, options }) => ({ id, options })));
    if (repairError) return NextResponse.json({ error: repairError.message }, { status: 500 });
  }
  if (!editableQuestions.length) return NextResponse.json({ saved: 0, repaired: frozenQuestions.length, frozen: frozenQuestions.length });
  const catalogRows = editableQuestions.map((question) => ({
    id: question.id, prompt: question.prompt, prompt_html: question.promptHtml,
    options: question.options, pillar: question.pillar, topic: question.topic, area: question.area,
    difficulty: question.difficulty, response_type: question.responseType,
    p_value: question.pValue, p_value_unit: question.pValueUnit, has_solution: question.hasSolution,
  }));
  const { error } = await admin.from("question_catalog").upsert(catalogRows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const keyRows = editableQuestions.filter((question) => question.answer.trim()).map((question) => ({ question_id: question.id, answer: question.answer, solution: question.solution, solution_html: question.solutionHtml }));
  if (keyRows.length) {
    const { error: keyError } = await admin.from("question_solutions").upsert(keyRows);
    if (keyError) return NextResponse.json({ error: keyError.message }, { status: 500 });
  }
  return NextResponse.json({ saved: editableQuestions.length, repaired: frozenQuestions.length, frozen: frozenQuestions.length });
}
