import { BONUS_POINTS, rank, tier, type Score } from "./scoring";

export type GroupQuestion = { id: string; position: number; text: string; answer: boolean | null };

/**
 * ניקוד בקבוצה: מנדטים/רה"מ/גוש תמיד מהניקוד הכללי.
 * בונוס — אם לקבוצה יש שאלות משלה, לפי התשובות לשאלות שלה; אחרת הבונוס הכללי.
 */
export function groupScore(base: Score, questions: GroupQuestion[], answers: Record<string, boolean>): Score {
  if (!questions.length) return base;
  let bonus_pts = 0;
  for (const q of questions) {
    if (q.answer === null) continue;
    if (answers[q.id] === q.answer) bonus_pts += BONUS_POINTS;
  }
  return { ...base, bonus_pts, total: base.seat_pts + base.pm_pts + base.bloc_pts + bonus_pts };
}

export function rankGroup<T extends Score & { submitted_at: string }>(rows: T[]) {
  return rank(rows).map((r) => ({ ...r, tier: tier(r.total) }));
}

// קוד הזמנה: 8 תווים בלי תווים מבלבלים (0/O, 1/l)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function newSlug(random: (n: number) => Uint8Array): string {
  return Array.from(random(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const GROUP_EMOJIS = ["🗳️", "🏢", "🏠", "👨‍👩‍👧", "🎓", "⚽", "☕", "🍕", "🎸", "💼", "🌊", "🔥", "🦄", "🐈", "🌵", "🚀"];
export const GROUP_COLORS = ["#22d3ee", "#ff2d55", "#1ee58a", "#ffd166", "#a78bfa", "#fb923c", "#f472b6", "#60a5fa"];
export const MAX_GROUP_QUESTIONS = 5;
