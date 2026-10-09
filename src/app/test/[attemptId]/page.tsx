import { AppShell } from "@/components/app-shell";
import { TestRunner } from "@/components/test-runner";
import { requireUser } from "@/lib/auth";

export default async function TestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireUser();
  const { attemptId } = await params;
  return <AppShell active="Sectionals" userName={user.email ?? "Member"}><TestRunner attemptId={attemptId}/></AppShell>;
}
