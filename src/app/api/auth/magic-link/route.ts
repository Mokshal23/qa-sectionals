import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Sign-in is not configured yet." }, { status: 503 });
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false, emailRedirectTo: `${new URL(request.url).origin}/auth/callback` },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
