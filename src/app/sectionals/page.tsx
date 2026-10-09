import { AppShell } from "@/components/app-shell";
import { SectionalsWorkspace } from "@/components/sectionals-workspace";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateSectionals } from "@/lib/generator";
import { redirect } from "next/navigation";
import type { Question } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SectionalsPage() {
  const user = await getCurrentUser();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (configured && !user) redirect("/login");
  const owner = user?.app_metadata?.role === "owner";
  let generated: ReturnType<typeof generateSectionals> | null = null;
  if (!configured) {
    const { loadQuestionBank } = await import("@/lib/bank");
    const bank = await loadQuestionBank();
    generated = generateSectionals(bank.questions);
  } else if (owner) {
    const admin = createSupabaseAdminClient();
    const [{ data: rows }, { data: keys }] = await Promise.all([admin.from("question_catalog").select("*"), admin.from("question_solutions").select("*")]);
    const allQuestions = (rows ?? []).map((row) => {
      const key = keys?.find((candidate) => candidate.question_id === row.id);
      const solution = key?.solution ?? "";
      const solutionHtml = key?.solution_html ?? "";
      return { id: row.id, prompt: row.prompt, promptHtml: row.prompt_html, options: row.options, answer: key?.answer ?? "", solution, solutionHtml, pillar: row.pillar, topic: row.topic, area: row.area, difficulty: row.difficulty, responseType: row.response_type, pValue: row.p_value === null ? null : Number(row.p_value), pValueUnit: row.p_value_unit, hasSolution: Boolean(solution.trim() || solutionHtml.trim()) } as Question;
    });
    const { data: usedRows } = await admin.from("sectional_questions").select("question_id");
    const used = new Set((usedRows ?? []).map((item) => item.question_id));
    generated = generateSectionals(allQuestions.filter((question) => !used.has(question.id)));
  }
  const supabase = user ? await createSupabaseServerClient() : null;
  const { data: rows } = supabase ? await supabase.from("sectionals").select("id,title,duration_seconds,created_at,sectional_questions(question_id,position)").eq("published", true).order("created_at", { ascending: false }) : { data: [] };
  const sectionals = (rows ?? []).map((row) => ({ ...row, questionCount: row.sectional_questions?.length ?? 22 }));
  return <AppShell active="Sectionals" userName={user?.email ?? "Preview"} role={owner ? "Organizer" : user ? "Participant" : "Preview"}><SectionalsWorkspace owner={owner} preview={!configured} sectionals={sectionals} generation={generated ? { maxForms: generated.maxForms, limitingCategory: generated.limitingCategory, eligibleQuestionCount: generated.eligibleQuestionCount, incompleteQuestionCount: generated.incompleteQuestionCount, incompleteByDifficulty: generated.incompleteByDifficulty, eligibleByDifficulty: generated.eligibleByDifficulty, topicTargetCounts: generated.topicTargetCounts, topicGeneratedCounts: generated.topicGeneratedCounts, forms: generated.forms.map((form, index) => ({ id: form.id, title: `Sectional ${String(sectionals.length + index + 1).padStart(2, "0")}`, topicCounts: form.topicCounts, difficultyCounts: form.difficultyCounts, questionIds: form.questionIds })) } : null} /></AppShell>;
}
