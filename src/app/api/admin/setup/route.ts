import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { email, token } = await request.json() as { email?: string; token?: string };
  const expected = process.env.OWNER_SETUP_TOKEN;
  if (!expected || !token || token.length !== expected.length || !await (async () => {
    const { timingSafeEqual } = await import("node:crypto");
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  })()) return NextResponse.json({ error: "Setup code is invalid." }, { status: 403 });
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: invites, error: inviteError } = await admin.from("platform_invites").select("email,role").eq("role", "owner").limit(1);
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });
  if (invites?.length) return NextResponse.json({ error: "Organizer setup has already been completed." }, { status: 409 });
  const origin = new URL(request.url).origin;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(cleanEmail, { redirectTo: `${origin}/auth/callback` });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Could not create organizer invite." }, { status: 400 });
  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role: "owner" } });
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
  const { error: storeError } = await admin.from("platform_invites").upsert({ email: cleanEmail, role: "owner" });
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
