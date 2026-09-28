import { TIERS } from "./copy";

export type Bloc = "coalition" | "opposition";

export type Bet = {
  seats: Record<string, number>;
  pm: string;
  bloc: Bloc;
  bonus: Record<string, boolean>;
};

// תוצאות יכולות להיות חלקיות (למשל בזמן מדגמים): שדה חסר = אין עליו נקודות.
export type Results = {
  seats: Record<string, number> | null;
  pm: string | null;
  bloc: Bloc | null;
  bonus: Record<string, boolean | null> | null;
};

export type Score = {
  total: number;
  seat_pts: number;
  pm_pts: number;
  bloc_pts: number;
  bonus_pts: number;
  exact_hits: number;
};

export const PM_POINTS = 25;
export const BLOC_POINTS = 10;
export const BONUS_POINTS = 5;

export function seatPoints(guess: number, actual: number): number {
  const d = Math.abs(guess - actual);
  if (d === 0) return 10;
  if (d === 1) return 7;
  if (d === 2) return 4;
  if (d === 3) return 2;
  return 0;
}

export function normalizePm(pm: string | null | undefined): string {
  if (!pm) return "";
  if (pm.startsWith("other:")) return "other:" + pm.slice(6).trim().toLowerCase().replace(/\s+/g, " ");
  return pm.trim();
}

export function score(bet: Bet, results: Results): Score {
  let seat_pts = 0;
  let exact_hits = 0;
  // מפלגות נספרות לפי מפתחות התוצאות; מפלגה שלא עברה מוזנת כ-0.
  for (const [key, actual] of Object.entries(results.seats ?? {})) {
    const guess = bet.seats[key] ?? 0;
    const pts = seatPoints(guess, actual);
    seat_pts += pts;
    if (pts === 10) exact_hits++;
  }

  const pmRes = normalizePm(results.pm);
  const pm_pts = pmRes && normalizePm(bet.pm) === pmRes ? PM_POINTS : 0;

  const bloc_pts = results.bloc && bet.bloc === results.bloc ? BLOC_POINTS : 0;

  let bonus_pts = 0;
  for (const [key, answer] of Object.entries(results.bonus ?? {})) {
    if (answer === null || answer === undefined) continue;
    if (bet.bonus[key] === answer) bonus_pts += BONUS_POINTS;
  }

  return {
    total: seat_pts + pm_pts + bloc_pts + bonus_pts,
    seat_pts,
    pm_pts,
    bloc_pts,
    bonus_pts,
    exact_hits,
  };
}

export function tier(total: number): string {
  return (TIERS.find((t) => total >= t.min) ?? TIERS[TIERS.length - 1]).name;
}

export type Rankable = Score & { submitted_at: string };

// סה"כ desc → pm_pts desc → exact_hits desc → submitted_at asc
export function compareRank(a: Rankable, b: Rankable): number {
  return (
    b.total - a.total ||
    b.pm_pts - a.pm_pts ||
    b.exact_hits - a.exact_hits ||
    new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
}

export function rank<T extends Rankable>(rows: T[]): (T & { place: number })[] {
  return [...rows].sort(compareRank).map((r, i) => ({ ...r, place: i + 1 }));
}
