import { NextResponse } from "next/server";
import { getOwnerApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("platform_invites").select("email,role,active,created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const { email } = await request.json() as { email?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const origin = new URL(request.url).origin;
  const [{ data: existingInvite }, { data: users }] = await Promise.all([
    admin.from("platform_invites").select("active,role").eq("email", cleanEmail).maybeSingle(),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (existingInvite?.active) return NextResponse.json({ error: "This email is already invited." }, { status: 409 });
  let targetUser = users.users.find((candidate) => candidate.email?.toLowerCase() === cleanEmail);
  if (targetUser) {
    const { error: roleError } = await admin.auth.admin.updateUserById(targetUser.id, { app_metadata: { ...targetUser.app_metadata, role: "participant", revoked: false } });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(cleanEmail, { redirectTo: `${origin}/auth/callback` });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Could not invite this person." }, { status: 400 });
    targetUser = data.user;
    const { error: roleError } = await admin.auth.admin.updateUserById(targetUser.id, { app_metadata: { role: "participant", revoked: false } });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
  }
  const { error: storeError } = await admin.from("platform_invites").upsert({ email: cleanEmail, role: "participant", active: true });
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  return NextResponse.json({ ok: true, restored: Boolean(existingInvite) });
}
