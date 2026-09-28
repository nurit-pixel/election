import "server-only";
import { supabaseServer } from "./supabase";
import { getResults, type BetRow, type ResultsRow } from "./data";
import { rank, tier, type Score } from "./scoring";

export type BoardEntry = Score & {
  player_id: string;
  name: string;
  submitted_at: string;
  place: number;
  tier: string;
  bet: BetRow;
};

export type BoardData = {
  results: ResultsRow;
  players: { id: string; name: string; hasBet: boolean }[];
  bets: BetRow[];
  ranking: BoardEntry[];
};

export async function loadBoard(): Promise<BoardData> {
  const db = supabaseServer();
  const [results, players, bets, scores] = await Promise.all([
    getResults(),
    db.from("players").select("id,name,created_at").order("created_at"),
    db.from("bets").select("*"),
    db.from("scores").select("*"),
  ]);
  if (players.error) throw players.error;
  if (bets.error) throw bets.error;
  if (scores.error) throw scores.error;

  const betBy = new Map((bets.data as BetRow[]).map((b) => [b.player_id, b]));
  const nameBy = new Map(players.data.map((p) => [p.id as string, p.name as string]));

  const rows = (scores.data as (Score & { player_id: string })[])
    .filter((s) => betBy.has(s.player_id))
    .map((s) => {
      const bet = betBy.get(s.player_id)!;
      return { ...s, name: nameBy.get(s.player_id) ?? "?", submitted_at: bet.submitted_at, tier: tier(s.total), bet };
    });

  return {
    results,
    players: players.data.map((p) => ({ id: p.id, name: p.name, hasBet: betBy.has(p.id) })),
    bets: bets.data as BetRow[],
    ranking: rank(rows),
  };
}
