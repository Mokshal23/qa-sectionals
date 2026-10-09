import { AppShell } from "@/components/app-shell";
import { SetupWorkspace } from "@/components/setup-workspace";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await getCurrentUser();
  const role = user?.app_metadata?.role === "owner" ? "Organizer" : user ? "Participant" : "Preview";
  return <AppShell active="Setup" userName={user?.email ?? "Preview"} role={role}><SetupWorkspace owner={role === "Organizer"} configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)} setupEnabled={Boolean(process.env.OWNER_SETUP_TOKEN)} /></AppShell>;
}
