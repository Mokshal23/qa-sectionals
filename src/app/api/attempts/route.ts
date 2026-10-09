import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { sectionalId } = await request.json() as { sectionalId?: string };
  if (!sectionalId) return NextResponse.json({ error: "Choose a sectional first." }, { status: 400 });
  const { data: sectional, error: sectionalError } = await auth.supabase.from("sectionals").select("id,title,duration_seconds,published").eq("id", sectionalId).eq("published", true).maybeSingle();
  if (sectionalError || !sectional) return NextResponse.json({ error: "This sectional is not available." }, { status: 404 });
  const { data: attempt, error } = await auth.supabase.from("attempts").insert({ owner_id: auth.user.id, sectional_id: sectionalId }).select("id,started_at,status").single();
  if (error || !attempt) return NextResponse.json({ error: error?.message ?? "Could not start attempt." }, { status: 500 });
  return NextResponse.json({ attempt, sectional });
}
