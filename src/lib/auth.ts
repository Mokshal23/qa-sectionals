import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.app_metadata?.role !== "owner") redirect("/");
  return user;
}
