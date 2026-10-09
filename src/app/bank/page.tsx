import { AppShell } from "@/components/app-shell";
import { BankWorkspace } from "@/components/bank-workspace";
import { getCurrentUser } from "@/lib/auth";
import { loadQuestionBank, summarizeBank } from "@/lib/bank";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const user = await getCurrentUser();
  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  if (user?.app_metadata?.role !== "owner" && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/");
  let stats = { total: 0, ready: 0, missingSolution: 0, difficultyCounts: { A: 0, B: 0, C: 0 }, readyCounts: { A: 0, B: 0, C: 0 }, topicCounts: {} as Record<string, number>, formatCounts: { MCQ: 0, TITA: 0 }, withPValue: 0 };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const bank = await loadQuestionBank();
    stats = summarizeBank(bank.questions);
  } else {
    const admin = createSupabaseAdminClient();
    const [{ data: rows }, { data: keys }] = await Promise.all([admin.from("question_catalog").select("id,difficulty,response_type,topic,pillar,area,has_solution,p_value"), admin.from("question_solutions").select("question_id")]);
    const keyIds = new Set((keys ?? []).map((key) => key.question_id));
    const readyCounts = { A: 0, B: 0, C: 0 };
    const difficultyCounts = { A: 0, B: 0, C: 0 };
    const topicCounts: Record<string, number> = {};
    const formatCounts = { MCQ: 0, TITA: 0 };
    for (const row of rows ?? []) {
      difficultyCounts[row.difficulty as "A" | "B" | "C"] += 1;
      formatCounts[row.response_type as "MCQ" | "TITA"] += 1;
      const topic = row.topic || row.pillar || row.area || "Unclassified";
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
      if (row.has_solution && keyIds.has(row.id)) readyCounts[row.difficulty as "A" | "B" | "C"] += 1;
    }
    stats = { total: rows?.length ?? 0, ready: Object.values(readyCounts).reduce((a,b)=>a+b,0), missingSolution: (rows ?? []).filter((row) => !row.has_solution || !keyIds.has(row.id)).length, difficultyCounts, readyCounts, topicCounts, formatCounts, withPValue: (rows ?? []).filter((row) => row.p_value !== null).length };
  }
  return <AppShell active="Question bank" userName={user?.email ?? "Preview"} role={user ? "Organizer" : "Preview"}><BankWorkspace stats={stats} preview={!process.env.NEXT_PUBLIC_SUPABASE_URL} /></AppShell>;
}
