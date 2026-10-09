import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";

export async function getApiUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "Database access is not configured." }, { status: 503 }) };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  const { data: active, error: activeError } = await supabase.rpc("is_active_member");
  if (activeError || active !== true) return { error: NextResponse.json({ error: "This account no longer has access to the workspace." }, { status: 403 }) };
  return { supabase, user };
}

export async function getOwnerApiUser() {
  const result = await getApiUser();
  if ("error" in result) return result;
  if (result.user.app_metadata?.role !== "owner") {
    return { error: NextResponse.json({ error: "Organizer access required." }, { status: 403 }) };
  }
  return result;
}
