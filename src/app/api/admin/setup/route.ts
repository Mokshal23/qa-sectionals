import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, token, password } = await request.json() as { email?: string; token?: string; password?: string };
  const expected = process.env.OWNER_SETUP_TOKEN;
  if (!expected || !token || token.length !== expected.length || !await (async () => {
    const { timingSafeEqual } = await import("node:crypto");
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  })()) return NextResponse.json({ error: "Setup code is invalid." }, { status: 403 });
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!password || password.length < 12 || password.length > 128) return NextResponse.json({ error: "Choose a password with at least 12 characters." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: invites, error: inviteError } = await admin.from("platform_invites").select("email,role").eq("role", "owner").limit(1);
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });
  if (invites?.length) return NextResponse.json({ error: "Organizer setup has already been completed." }, { status: 409 });
  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return NextResponse.json({ error: "Could not prepare organizer account." }, { status: 500 });
  const existing = listedUsers.users.find((user) => user.email?.toLowerCase() === cleanEmail);
  const { data, error } = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true, app_metadata: { ...existing.app_metadata, role: "owner", revoked: false } })
    : await admin.auth.admin.createUser({ email: cleanEmail, password, email_confirm: true, app_metadata: { role: "owner", revoked: false } });
  if (error || !data.user) return NextResponse.json({ error: "Could not create organizer account." }, { status: 400 });
  const { error: storeError } = await admin.from("platform_invites").upsert({ email: cleanEmail, role: "owner", active: true, invite_token_hash: null, invite_expires_at: null, claimed_at: new Date().toISOString() });
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Sign-in is not configured yet." }, { status: 503 });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (signInError) return NextResponse.json({ error: "Organizer created. Return to sign in with the password you chose." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
