import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("sectionals").select("id,title,duration_seconds,created_at,sectional_questions(question_id,position)").eq("published", true).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sectionals: data ?? [] });
}
