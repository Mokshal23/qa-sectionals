import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { loadQuestionBank } from "@/lib/bank";
import { generateSectionals } from "@/lib/generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Question } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) {
    const bank = await loadQuestionBank();
    const generated = generateSectionals(bank.questions);
    return <AppShell active="Overview"><Dashboard totalQuestions={bank.questions.length} readyQuestions={generated.eligibleQuestionCount} missingSolutions={generated.noSolutionQuestions} generated={generated} preview /></AppShell>;
  }
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const owner = user.app_metadata?.role === "owner";
  if (owner) {
    let allQuestions: Question[] = [];
    let availableQuestions: Question[] = [];
    let publishedForms: Array<{ id: string; title: string; duration_seconds: number }> = [];
    try {
      const admin = createSupabaseAdminClient();
      const [{ data: rows }, { data: keys }, { data: usedRows }] = await Promise.all([admin.from("question_catalog").select("*"), admin.from("question_solutions").select("*"), admin.from("sectional_questions").select("question_id")]);
      allQuestions = (rows ?? []).map((row) => {
        const key = keys?.find((candidate) => candidate.question_id === row.id);
        return { id: row.id, prompt: row.prompt, promptHtml: row.prompt_html, options: row.options, answer: key?.answer ?? "", solution: key?.solution ?? "", solutionHtml: key?.solution_html ?? "", pillar: row.pillar, topic: row.topic, area: row.area, difficulty: row.difficulty, responseType: row.response_type, pValue: row.p_value === null ? null : Number(row.p_value), pValueUnit: row.p_value_unit, hasSolution: row.has_solution } as Question;
      });
      const used = new Set((usedRows ?? []).map((item) => item.question_id));
      availableQuestions = allQuestions.filter((question) => !used.has(question.id));
      const { data } = await admin.from("sectionals").select("id,title,duration_seconds").eq("published", true).order("created_at", { ascending: false });
      publishedForms = data ?? [];
    } catch { /* The setup screen explains missing database configuration. */ }
    const allGeneration = generateSectionals(allQuestions);
    const generated = generateSectionals(availableQuestions);
    return <AppShell active="Overview" userName={user.email ?? "Organizer"} role="Organizer"><Dashboard totalQuestions={allQuestions.length} readyQuestions={allGeneration.eligibleQuestionCount} missingSolutions={allGeneration.noSolutionQuestions} generated={generated} preview={false} owner sectionals={publishedForms} /></AppShell>;
  }
  const supabase = await createSupabaseServerClient();
  const [{ data: sectionals }, { data: attempts }] = await Promise.all([
    supabase!.from("sectionals").select("id,title,duration_seconds,created_at").eq("published", true).order("created_at", { ascending: false }),
    supabase!.from("attempts").select("id,sectional_id,status,started_at,submitted_at,score").order("started_at", { ascending: false }).limit(10),
  ]);
  return <AppShell active="Overview" userName={user.email ?? "Member"} role="Participant"><Dashboard totalQuestions={0} readyQuestions={0} missingSolutions={0} generated={generateSectionals([])} preview={false} sectionals={sectionals ?? []} attempts={attempts ?? []} /></AppShell>;
}
