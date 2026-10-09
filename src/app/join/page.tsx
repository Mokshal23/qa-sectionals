import { JoinWorkspace } from "@/components/join-workspace";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return <JoinWorkspace configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} />;
}
