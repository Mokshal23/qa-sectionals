import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email?: string; password?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !password) {
    return NextResponse.json({ error: "Enter your invited email and password." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Sign-in is not configured yet." }, { status: 503 });
  const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  return NextResponse.json({ ok: true });
}
