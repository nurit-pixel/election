import "server-only";
import { supabaseServer } from "./supabase";
import { getResults, type BetRow, type ResultsRow } from "./data";
import { rank, tier, type Score } from "./scoring";
import { badgesByPlayer, computeBadges, type BadgeKey } from "./badges";
import { PARTY_KEYS } from "./parties";
import { groupScore, type GroupQuestion } from "./groupScore";
import { getAnswers, getQuestions } from "./groups";

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
  /** תג → מזהה השחקן שמחזיק בו */
  badges: Partial<Record<BadgeKey, string>>;
  /** מזהה שחקן → התגים שלו */
  playerBadges: Record<string, BadgeKey[]>;
};

/**
 * נתוני לוח. בלי groupId — כל המשתתפים (הניקוד הכללי).
 * עם groupId — רק חברי הקבוצה, ואם לקבוצה יש שאלות בונוס משלה הן מחליפות את הבונוס הכללי.
 */
export async function loadBoard(groupId?: string): Promise<BoardData & { questions: GroupQuestion[] }> {
  const db = supabaseServer();
  let memberIds: string[] | null = null;
  if (groupId) {
    const { data, error } = await db.from("group_members").select("player_id").eq("group_id", groupId);
    if (error) throw error;
    memberIds = (data ?? []).map((r) => r.player_id);
  }
  // כשיש קבוצה מסננים לפי החברים (רשימה ריקה → מזהה שלא קיים, כדי לא להחזיר את כולם)
  const ids = memberIds && (memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const playersQ = db.from("players").select("id,name,created_at").order("created_at");
  const betsQ = db.from("bets").select("*");
  const scoresQ = db.from("scores").select("*");
  const [results, players, bets, scores, questions] = await Promise.all([
    getResults(),
    ids ? playersQ.in("id", ids) : playersQ,
    ids ? betsQ.in("player_id", ids) : betsQ,
    ids ? scoresQ.in("player_id", ids) : scoresQ,
    groupId ? getQuestions(groupId) : Promise.resolve([] as GroupQuestion[]),
  ]);
  if (players.error) throw players.error;
  if (bets.error) throw bets.error;
  if (scores.error) throw scores.error;
  const answers = questions.length ? await getAnswers(questions.map((q) => q.id)) : {};

  const betBy = new Map((bets.data as BetRow[]).map((b) => [b.player_id, b]));
  const nameBy = new Map(players.data.map((p) => [p.id as string, p.name as string]));

  const rows = (scores.data as (Score & { player_id: string })[])
    .filter((s) => betBy.has(s.player_id))
    .map((s) => {
      const bet = betBy.get(s.player_id)!;
      const gs = groupScore(s, questions, answers[s.player_id] ?? {});
      return { ...s, ...gs, name: nameBy.get(s.player_id) ?? "?", submitted_at: bet.submitted_at, tier: tier(gs.total), bet };
    });

  const badges = computeBadges(bets.data as BetRow[], PARTY_KEYS);

  return {
    results,
    players: players.data.map((p) => ({ id: p.id, name: p.name, hasBet: betBy.has(p.id) })),
    bets: bets.data as BetRow[],
    ranking: rank(rows),
    badges,
    playerBadges: badgesByPlayer(badges),
    questions,
  };
}
