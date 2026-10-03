import "server-only";
import { supabaseServer } from "./supabase";
import type { Bet } from "./scoring";
import type { HistoryEntry } from "./historyDiff";

// שומר תמונת מצב של הגשה. לא מפיל את השליחה אם הטבלה עוד לא קיימת (מיגרציה 002 לא הורצה).
export async function addHistory(playerId: string, bet: Bet): Promise<void> {
  const { error } = await supabaseServer().from("bet_history").insert({ player_id: playerId, ...bet });
  if (error) console.warn("bet_history insert failed:", error.message);
}

/** available=false כשהטבלה לא קיימת — הממשק מציג הודעה במקום רשימה */
export async function getHistory(playerId: string): Promise<{ available: boolean; entries: HistoryEntry[] }> {
  const { data, error } = await supabaseServer()
    .from("bet_history")
    .select("id,seats,pm,bloc,bonus,created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { available: false, entries: [] };
  return { available: true, entries: data as HistoryEntry[] };
}
