import "server-only";
import { supabaseServer } from "@/lib/supabase";
import type { Snapshot } from "./types";

// אם Supabase לא מוגדר, נשמרים בזיכרון התהליך בלבד (מתאפס בכל פריסה)
const memory: { at: string; payload: Snapshot }[] = [];

function hasDb(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function latestSnapshot(): Promise<Snapshot | null> {
  if (!hasDb()) return memory.at(-1)?.payload ?? null;
  const { data, error } = await supabaseServer()
    .from("iran_snapshots")
    .select("payload")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as Snapshot | undefined) ?? null;
}

export type HistoryPoint = { at: string; values: Record<string, number>; quotes: Snapshot["quotes"] };

export async function history(days = 14): Promise<HistoryPoint[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows: { at: string; payload: Snapshot }[] = hasDb()
    ? ((
        await supabaseServer()
          .from("iran_snapshots")
          .select("created_at, payload->values, payload->quotes")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(500)
      ).data ?? []).map((r: Record<string, unknown>) => ({
        at: r.created_at as string,
        payload: { values: r.values, quotes: r.quotes } as Snapshot,
      }))
    : memory.filter((m) => m.at >= since);
  return rows.map((r) => ({ at: r.at, values: r.payload.values ?? {}, quotes: r.payload.quotes ?? {} }));
}

export async function saveSnapshot(s: Snapshot): Promise<void> {
  if (!hasDb()) {
    memory.push({ at: s.createdAt, payload: s });
    if (memory.length > 400) memory.shift();
    return;
  }
  const { error } = await supabaseServer().from("iran_snapshots").insert({ created_at: s.createdAt, payload: s });
  if (error) throw new Error(error.message);
}
