import "server-only";
import { supabaseServer } from "./supabase";
import { getResults, type BetRow } from "./data";
import { score } from "./scoring";

// מחשב מחדש את הניקוד של כל ההימורים מול התוצאות השמורות ושומר ב-scores. מחזיר את מספר השחקנים.
export async function recomputeScores(): Promise<number> {
  const db = supabaseServer();
  const results = await getResults();
  const { data: bets, error } = await db.from("bets").select("*");
  if (error) throw error;

  const now = new Date().toISOString();
  const rows = (bets as BetRow[]).map((b) => ({ player_id: b.player_id, ...score(b, results), computed_at: now }));
  if (rows.length) {
    const up = await db.from("scores").upsert(rows, { onConflict: "player_id" });
    if (up.error) throw up.error;
  }
  return rows.length;
}
