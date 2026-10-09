import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, inviteCode, password } = await request.json() as { email?: string; inviteCode?: string; password?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter the invited email address." }, { status: 400 });
  if (!inviteCode || inviteCode.length < 24 || inviteCode.length > 100) return NextResponse.json({ error: "The invite code is invalid or expired." }, { status: 400 });
  if (!password || password.length < 12 || password.length > 128) return NextResponse.json({ error: "Choose a password with at least 12 characters." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const tokenHash = createHash("sha256").update(inviteCode).digest("hex");
  const claimedAt = new Date().toISOString();
  const { data: invite, error: claimError } = await admin.from("platform_invites")
    .update({ invite_token_hash: null, invite_expires_at: null, claimed_at: claimedAt })
    .eq("email", cleanEmail).eq("role", "participant").eq("active", true)
    .eq("invite_token_hash", tokenHash).is("claimed_at", null).gt("invite_expires_at", claimedAt)
    .select("email").maybeSingle();
  if (claimError) return NextResponse.json({ error: "Could not validate the invite code." }, { status: 500 });
  if (!invite) return NextResponse.json({ error: "The invite code is invalid, expired, or already used." }, { status: 400 });

  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return NextResponse.json({ error: "Could not prepare the invited account." }, { status: 500 });
  const existing = listedUsers.users.find((user) => user.email?.toLowerCase() === cleanEmail);
  if (existing?.app_metadata?.role === "owner") return NextResponse.json({ error: "This address already belongs to the organizer." }, { status: 409 });

  const attributes = { password, email_confirm: true, app_metadata: { ...(existing?.app_metadata ?? {}), role: "participant", revoked: false } };
  const { data: userData, error: userError } = existing
    ? await admin.auth.admin.updateUserById(existing.id, attributes)
    : await admin.auth.admin.createUser({ email: cleanEmail, ...attributes });
  if (userError || !userData.user) {
    await admin.from("platform_invites").update({ invite_token_hash: tokenHash, invite_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), claimed_at: null }).eq("email", cleanEmail).eq("claimed_at", claimedAt);
    return NextResponse.json({ error: "Could not create the account. Ask the organizer for a fresh invite code." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Sign-in is not configured yet." }, { status: 503 });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (signInError) return NextResponse.json({ error: "Account created. Return to sign in with the password you chose." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
