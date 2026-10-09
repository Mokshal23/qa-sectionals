import { NextResponse } from "next/server";
import { getOwnerApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ email: string }> }) {
  const auth = await getOwnerApiUser();
  if ("error" in auth) return auth.error;
  const { email } = await params;
  const cleanEmail = decodeURIComponent(email).trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin.from("platform_invites").select("email,role").eq("email", cleanEmail).maybeSingle();
  if (error || !invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  if (invite.role === "owner") return NextResponse.json({ error: "The organizer invitation cannot be revoked here." }, { status: 400 });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = users.users.find((user) => user.email?.toLowerCase() === cleanEmail);
  if (target) {
    const { error: revokeError } = await admin.auth.admin.updateUserById(target.id, { app_metadata: { ...target.app_metadata, role: "participant", revoked: true } });
    if (revokeError) return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }
  const { error: inviteError } = await admin.from("platform_invites").update({ active: false }).eq("email", cleanEmail);
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
