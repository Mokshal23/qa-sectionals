import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getOwnerApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("platform_invites").select("email,role,active,created_at,claimed_at,invite_expires_at").order("created_at", { ascending: false });
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
  const { data: existingInvite, error: lookupError } = await admin.from("platform_invites").select("active,role,claimed_at,invite_expires_at").eq("email", cleanEmail).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not check existing invitations." }, { status: 500 });
  if (existingInvite?.role === "owner") return NextResponse.json({ error: "This email belongs to the organizer." }, { status: 409 });
  if (existingInvite?.active && (existingInvite.claimed_at || (existingInvite.invite_expires_at && new Date(existingInvite.invite_expires_at) > new Date()))) {
    return NextResponse.json({ error: "This member already has active access or a valid invite code." }, { status: 409 });
  }
  const inviteCode = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(inviteCode).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: storeError } = await admin.from("platform_invites").upsert({
    email: cleanEmail, role: "participant", active: true,
    invite_token_hash: tokenHash, invite_expires_at: expiresAt, claimed_at: null,
  });
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  return NextResponse.json({ ok: true, inviteCode, expiresAt, restored: Boolean(existingInvite) });
}
