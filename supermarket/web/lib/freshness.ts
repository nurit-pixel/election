/**
 * רעננות מחירים ותג "הכי משתלם", לפי חוזי הרכיבים של חבילת המיתוג. פונקציות טהורות.
 *
 * - fresh: המחיר עודכן בתוך חלון הרעננות (ברירת מחדל 36 שעות).
 * - aging: ישן יותר, עד שבוע.
 * - stale: ישן משבוע.
 * - unknown: לא ידוע מתי עודכן. לעולם לא נחשב רענן.
 *
 * תג "הכי משתלם" ניתן רק לסל מלא ורענן, והוא הזול מבין הסלים שעומדים באותם תנאים.
 */

export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export const FRESH_HOURS = 36;
export const AGING_HOURS = 24 * 7;

export function freshness(observedAt: string | null | undefined, now: Date, freshHours = FRESH_HOURS): Freshness {
  if (!observedAt) return "unknown";
  const time = new Date(observedAt).getTime();
  if (Number.isNaN(time)) return "unknown";
  const hours = (now.getTime() - time) / 3_600_000;
  if (hours <= freshHours) return "fresh";
  return hours <= Math.max(AGING_HOURS, freshHours) ? "aging" : "stale";
}

const ORDER: Freshness[] = ["fresh", "aging", "stale", "unknown"];

/** הרעננות של סל שלם היא של המחיר הישן ביותר בו */
export function worstFreshness(values: Freshness[]): Freshness {
  return values.reduce<Freshness>((worst, v) => (ORDER.indexOf(v) > ORDER.indexOf(worst) ? v : worst), "fresh");
}

/** "לפני שעתיים", "לפני 4 ימים" */
export function relativeTime(observedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(observedAt).getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "לפני דקה" : `לפני ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : hours === 2 ? "לפני שעתיים" : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days < 14) return days === 1 ? "אתמול" : days === 2 ? "לפני יומיים" : `לפני ${days} ימים`;
  const weeks = Math.round(days / 7);
  return `לפני ${weeks} שבועות`;
}

export function freshnessText(status: Freshness, observedAt: string | null | undefined, now: Date): string {
  if (status === "unknown" || !observedAt) return "לא ידוע מתי המחיר עודכן";
  if (status === "stale") return `מחיר ישן (${relativeTime(observedAt, now)}) – לבדוק לפני שיוצאים`;
  return `עודכן ${relativeTime(observedAt, now)}`;
}

export type WinnerCandidate = { complete: boolean; freshness: Freshness; total: number };

/** האינדקס של הסל שמקבל "הכי משתלם", או -1 אם אין סל מלא ורענן */
export function winnerIndex(candidates: WinnerCandidate[]): number {
  let best = -1;
  candidates.forEach((c, i) => {
    if (!c.complete || c.freshness !== "fresh") return;
    if (best === -1 || c.total < candidates[best].total) best = i;
  });
  return best;
}

/** שם נגיש למחיר: "284 שקלים ו-90 אגורות" */
export function spokenPrice(value: number): string {
  const agorot = Math.round(value * 100);
  const shekels = Math.floor(agorot / 100);
  const rest = agorot % 100;
  const main = shekels === 1 ? "שקל אחד" : `${shekels} שקלים`;
  return rest === 0 ? main : `${main} ו-${rest} אגורות`;
}
