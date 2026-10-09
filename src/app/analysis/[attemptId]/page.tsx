import { AppShell } from "@/components/app-shell";
import { AnalysisReport } from "@/components/analysis-report";
import { requireUser } from "@/lib/auth";

export default async function AnalysisPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireUser();
  const { attemptId } = await params;
  return <AppShell active="Analysis" userName={user.email ?? "Member"}><AnalysisReport attemptId={attemptId}/></AppShell>;
}
