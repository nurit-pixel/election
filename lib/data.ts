import "server-only";
import { supabaseServer } from "./supabase";
import type { Bet, Bloc } from "./scoring";

export type Mode = "none" | "exit_poll" | "official";

export type ResultsRow = {
  seats: Record<string, number> | null;
  pm: string | null;
  bloc: Bloc | null;
  bonus: Record<string, boolean | null> | null;
  mode: Mode;
  lock_override: string | null;
  updated_at: string | null;
};

export type BetRow = Bet & { player_id: string; submitted_at: string; updated_at: string };

export const DEFAULT_LOCK_AT = "2026-10-27T22:00:00+03:00";

export async function getResults(): Promise<ResultsRow> {
  const { data, error } = await supabaseServer().from("results").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (
    data ?? { seats: null, pm: null, bloc: null, bonus: null, mode: "none", lock_override: null, updated_at: null }
  );
}

export function lockAt(results: Pick<ResultsRow, "lock_override">): string {
  return results.lock_override ?? process.env.LOCK_AT ?? DEFAULT_LOCK_AT;
}

export function isLocked(results: Pick<ResultsRow, "lock_override">, now = Date.now()): boolean {
  return now >= new Date(lockAt(results)).getTime();
}

export async function getPlayer(id: string): Promise<{ id: string; name: string } | null> {
  const { data } = await supabaseServer().from("players").select("id,name").eq("id", id).maybeSingle();
  return data;
}

export async function getBet(playerId: string): Promise<BetRow | null> {
  const { data, error } = await supabaseServer().from("bets").select("*").eq("player_id", playerId).maybeSingle();
  if (error) throw error;
  return data;
}
