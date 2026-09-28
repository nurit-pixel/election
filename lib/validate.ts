import { PARTY_KEYS, PM_PARTIES, TOTAL_SEATS, MAX_SEATS_PER_PARTY } from "./parties";
import { BONUS_KEYS } from "./copy";
import type { Bet, Bloc } from "./scoring";

export type Draft = {
  seats: Record<string, number>;
  pm: string | null;
  pmOther: string;
  bloc: Bloc | null;
  bonus: Record<string, boolean | null>;
};

export const PM_OTHER_MAX = 60;

export function emptyDraft(): Draft {
  return {
    seats: Object.fromEntries(PARTY_KEYS.map((k) => [k, 0])),
    pm: null,
    pmOther: "",
    bloc: null,
    bonus: Object.fromEntries(BONUS_KEYS.map((k) => [k, null])),
  };
}

export function betToDraft(bet: Bet): Draft {
  const d = emptyDraft();
  for (const k of PARTY_KEYS) d.seats[k] = bet.seats[k] ?? 0;
  if (bet.pm.startsWith("other:")) {
    d.pm = "other";
    d.pmOther = bet.pm.slice(6);
  } else d.pm = bet.pm;
  d.bloc = bet.bloc;
  for (const k of BONUS_KEYS) d.bonus[k] = typeof bet.bonus[k] === "boolean" ? bet.bonus[k] : null;
  return d;
}

export function seatSum(seats: Record<string, number>) {
  return PARTY_KEYS.reduce((s, k) => s + (seats[k] ?? 0), 0);
}

export function draftToBet(d: Draft): Bet | null {
  if (seatSum(d.seats) !== TOTAL_SEATS) return null;
  if (!d.pm || !d.bloc) return null;
  if (d.pm === "other" && !d.pmOther.trim()) return null;
  if (BONUS_KEYS.some((k) => d.bonus[k] === null || d.bonus[k] === undefined)) return null;
  return {
    seats: Object.fromEntries(PARTY_KEYS.map((k) => [k, d.seats[k] ?? 0])),
    pm: d.pm === "other" ? `other:${d.pmOther.trim().slice(0, PM_OTHER_MAX)}` : d.pm,
    bloc: d.bloc,
    bonus: Object.fromEntries(BONUS_KEYS.map((k) => [k, !!d.bonus[k]])),
  };
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export function validPm(pm: unknown): pm is string {
  if (typeof pm !== "string") return false;
  if (pm === "none") return true;
  if (pm.startsWith("other:")) {
    const t = pm.slice(6).trim();
    return t.length > 0 && t.length <= PM_OTHER_MAX;
  }
  return PM_PARTIES.some((p) => p.key === pm);
}

// ולידציה בצד השרת: מחזיר Bet נקי או הודעת שגיאה.
export function parseBet(body: unknown): { bet: Bet } | { error: string } {
  if (!body || typeof body !== "object") return { error: "bad body" };
  const b = body as Record<string, unknown>;
  const seatsIn = b.seats as Record<string, unknown> | undefined;
  if (!seatsIn || typeof seatsIn !== "object") return { error: "missing seats" };
  const seats: Record<string, number> = {};
  for (const k of PARTY_KEYS) {
    const v = seatsIn[k];
    if (!isInt(v) || v < 0 || v > MAX_SEATS_PER_PARTY) return { error: `bad seats for ${k}` };
    seats[k] = v;
  }
  if (Object.keys(seatsIn).some((k) => !PARTY_KEYS.includes(k))) return { error: "unknown party" };
  if (seatSum(seats) !== TOTAL_SEATS) return { error: "seats must sum to 120" };
  if (!validPm(b.pm)) return { error: "bad pm" };
  if (b.bloc !== "coalition" && b.bloc !== "opposition") return { error: "bad bloc" };
  const bonusIn = b.bonus as Record<string, unknown> | undefined;
  if (!bonusIn || typeof bonusIn !== "object") return { error: "missing bonus" };
  const bonus: Record<string, boolean> = {};
  for (const k of BONUS_KEYS) {
    if (typeof bonusIn[k] !== "boolean") return { error: `bad bonus ${k}` };
    bonus[k] = bonusIn[k] as boolean;
  }
  const pm = (b.pm as string).startsWith("other:") ? `other:${(b.pm as string).slice(6).trim()}` : (b.pm as string);
  return { bet: { seats, pm, bloc: b.bloc, bonus } };
}

export function normalizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.normalize("NFC").trim().replace(/\s+/g, " ").slice(0, 30);
}
