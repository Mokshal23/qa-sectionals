import { NextResponse } from "next/server";
import { getOwnerApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Question } from "@/lib/domain";
import { generateSectionals } from "@/lib/generator";

export async function POST() {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const admin = createSupabaseAdminClient();
  const [{ data: rows, error }, { data: keys, error: keyError }, { data: usedRows }, { data: existingForms }] = await Promise.all([
    admin.from("question_catalog").select("*"), admin.from("question_solutions").select("*"),
    admin.from("sectional_questions").select("question_id"), admin.from("sectionals").select("id,title").eq("published", true),
  ]);
  if (error || keyError) return NextResponse.json({ error: error?.message ?? keyError?.message }, { status: 500 });
  const bank = (rows ?? []).map((row) => {
    const key = keys?.find((candidate) => candidate.question_id === row.id);
    const solution = key?.solution ?? "";
    const solutionHtml = key?.solution_html ?? "";
    return { id: row.id, prompt: row.prompt, promptHtml: row.prompt_html, options: row.options, answer: key?.answer ?? "", solution, solutionHtml, pillar: row.pillar, topic: row.topic, area: row.area, difficulty: row.difficulty, responseType: row.response_type, pValue: row.p_value === null ? null : Number(row.p_value), pValueUnit: row.p_value_unit, hasSolution: Boolean(solution.trim() || solutionHtml.trim()) } as Question;
  });
  const alreadyUsed = new Set((usedRows ?? []).map((item) => item.question_id));
  const generated = generateSectionals(bank.filter((question) => !alreadyUsed.has(question.id)));
  if (!generated.maxForms) return NextResponse.json({ error: "There are not enough complete questions to assemble a 22-question form.", generated }, { status: 422 });
  const release = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const firstNumber = (existingForms ?? []).length;
  const sectionalRows = generated.forms.map((form, index) => ({ id: `sectional-${release}-${String(index + 1).padStart(2, "0")}`, title: `Sectional ${String(firstNumber + index + 1).padStart(2, "0")}`, duration_seconds: 2400, published: true }));
  const { error: formError } = await admin.from("sectionals").insert(sectionalRows);
  if (formError) return NextResponse.json({ error: formError.message }, { status: 500 });
  const itemRows = generated.forms.flatMap((form, formIndex) => form.questionIds.map((questionId, index) => ({ sectional_id: sectionalRows[formIndex].id, question_id: questionId, position: index + 1 })));
  const { error: itemError } = await admin.from("sectional_questions").insert(itemRows);
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  return NextResponse.json({ published: generated.forms.length, generated });
}
