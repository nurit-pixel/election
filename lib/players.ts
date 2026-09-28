import "server-only";
import { supabaseServer } from "./supabase";

export type AdminPlayer = {
  id: string;
  name: string;
  created_at: string;
  hasBet: boolean;
  updated_at: string | null;
  total: number | null;
};

// רשימת שחקנים לחדר המצב: מי הגיש, מתי עודכן, וכמה נקודות (אם כבר חושב)
export async function listPlayers(): Promise<AdminPlayer[]> {
  const db = supabaseServer();
  const [players, bets, scores] = await Promise.all([
    db.from("players").select("id,name,created_at").order("created_at"),
    db.from("bets").select("player_id,updated_at"),
    db.from("scores").select("player_id,total"),
  ]);
  if (players.error) throw players.error;
  const betBy = new Map((bets.data ?? []).map((b) => [b.player_id as string, b.updated_at as string]));
  const scoreBy = new Map((scores.data ?? []).map((s) => [s.player_id as string, s.total as number]));
  return players.data.map((p) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    hasBet: betBy.has(p.id),
    updated_at: betBy.get(p.id) ?? null,
    total: scoreBy.get(p.id) ?? null,
  }));
}
