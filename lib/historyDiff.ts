import { BONUS } from "./copy";
import { PARTIES } from "./parties";
import type { Bet } from "./scoring";
import { pmLabel } from "./betLabels";

export type HistoryEntry = Bet & { id: number; created_at: string };

export type Change =
  | { kind: "seats"; party: string; from: number; to: number }
  | { kind: "pm"; from: string; to: string }
  | { kind: "bloc"; from: string; to: string }
  | { kind: "bonus"; question: string; from: boolean; to: boolean };

const blocLabel = (b: string) => (b === "coalition" ? "קואליציה" : "אופוזיציה");

/** מה השתנה בין שתי הגשות (prev → next). מפלגות לפי סדר הרשימה. */
export function diffBets(prev: Bet, next: Bet): Change[] {
  const out: Change[] = [];
  for (const p of PARTIES) {
    const a = prev.seats[p.key] ?? 0;
    const b = next.seats[p.key] ?? 0;
    if (a !== b) out.push({ kind: "seats", party: p.name, from: a, to: b });
  }
  if (prev.pm !== next.pm) out.push({ kind: "pm", from: pmLabel(prev.pm), to: pmLabel(next.pm) });
  if (prev.bloc !== next.bloc) out.push({ kind: "bloc", from: blocLabel(prev.bloc), to: blocLabel(next.bloc) });
  for (const q of BONUS) {
    const a = !!prev.bonus[q.key];
    const b = !!next.bonus[q.key];
    if (a !== b) out.push({ kind: "bonus", question: q.text, from: a, to: b });
  }
  return out;
}

const yesNo = (v: boolean) => (v ? "כן" : "לא");

export function describeChange(c: Change): string {
  switch (c.kind) {
    case "seats":
      return `${c.party}: ${c.from} ← ${c.to}`;
    case "pm":
      return `רה"מ: ${c.from} ← ${c.to}`;
    case "bloc":
      return `גוש: ${c.from} ← ${c.to}`;
    case "bonus":
      return `${c.question} ${yesNo(c.from)} ← ${yesNo(c.to)}`;
  }
}

/**
 * מסדר היסטוריה מהחדש לישן, ומצמיד לכל הגשה את השינויים לעומת זו שלפניה.
 * הגשות שלא שינו כלום (שליחה חוזרת זהה) מסומנות ב-changes ריק.
 */
export function withChanges(entries: HistoryEntry[]): (HistoryEntry & { changes: Change[] | null })[] {
  const asc = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id);
  return asc
    .map((e, i) => ({ ...e, changes: i === 0 ? null : diffBets(asc[i - 1], e) }))
    .reverse();
}
