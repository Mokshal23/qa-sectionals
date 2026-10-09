import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("error" in auth) return auth.error;
  const { sectionalId } = await request.json() as { sectionalId?: string };
  if (!sectionalId) return NextResponse.json({ error: "Choose a sectional first." }, { status: 400 });
  const { data: sectional, error: sectionalError } = await auth.supabase.from("sectionals").select("id,title,duration_seconds,published").eq("id", sectionalId).eq("published", true).maybeSingle();
  if (sectionalError || !sectional) return NextResponse.json({ error: "This sectional is not available." }, { status: 404 });

  const findExistingAttempt = async () => {
    const { data, error } = await auth.supabase.from("attempts")
      .select("id,started_at,status,sectional_id")
      .eq("owner_id", auth.user.id)
      .eq("sectional_id", sectionalId)
      .order("started_at", { ascending: false });
    if (error) return { attempt: null, error };
    const existing = data?.find((candidate) => candidate.status === "in_progress") ?? data?.[0] ?? null;
    return { attempt: existing, error: null };
  };

  const previous = await findExistingAttempt();
  if (previous.error) return NextResponse.json({ error: "Could not check your attempt history." }, { status: 500 });
  if (previous.attempt) return NextResponse.json({ attempt: previous.attempt, sectional, resumed: true });

  const { data: attempt, error } = await auth.supabase.from("attempts")
    .insert({ owner_id: auth.user.id, sectional_id: sectionalId })
    .select("id,started_at,status,sectional_id")
    .single();
  if (!error && attempt) return NextResponse.json({ attempt, sectional, resumed: false });

  // A database trigger claims each participant/sectional pair atomically. If
  // two tabs race to start, return the one winning attempt instead of creating
  // a second attempt or surfacing a raw database error.
  if (error?.code === "23505") {
    const raced = await findExistingAttempt();
    if (raced.attempt) return NextResponse.json({ attempt: raced.attempt, sectional, resumed: true });
  }
  return NextResponse.json({ error: "Could not start attempt." }, { status: 500 });
}
