import { AppShell } from "@/components/app-shell";
import { PeopleWorkspace } from "@/components/people-workspace";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "owner") redirect("/");
  return <AppShell active="Members" userName={user.email ?? "Organizer"} role="Organizer"><PeopleWorkspace /></AppShell>;
}
