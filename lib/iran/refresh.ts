import "server-only";
import { summarize, tagHeadline } from "./tags";
import { fetchHeadlines, fetchPolymarket, fetchQuotes } from "./feeds";
import { latestSnapshot, saveSnapshot } from "./store";
import type { Snapshot } from "./types";

// עדכון רק בלחיצה על "רענן". המתנה קצרה בין סבבים, כדי לא להציף את מקורות החדשות והמחירים
export const COOLDOWN_MIN = Number(process.env.IRAN_COOLDOWN_MIN) || 2;

let running: Promise<Snapshot> | null = null;

export function nextAllowedAt(last: Snapshot | null): string | null {
  if (!last) return null;
  const t = Date.parse(last.createdAt) + COOLDOWN_MIN * 60_000;
  return t > Date.now() ? new Date(t).toISOString() : null;
}

export function isRunning(): boolean {
  return running !== null;
}

async function doRefresh(): Promise<Snapshot> {
  const now = new Date();
  const [headlines, quotes, markets] = await Promise.all([
    fetchHeadlines().catch(() => []),
    fetchQuotes().catch(() => ({})),
    fetchPolymarket().catch(() => []),
  ]);
  const items = headlines.slice(0, 50).map(tagHeadline);
  const failed = [!headlines.length && "כותרות", !Object.keys(quotes).length && "מחירים", !markets.length && "Polymarket"].filter(Boolean);

  // בלי מודל שפה: הרענון מביא כותרות ומחירים בלבד, והאינדיקטורים נשארים בשליטת המשתמש
  const snap: Snapshot = {
    createdAt: now.toISOString(),
    values: {},
    status: {},
    news: [],
    quotes,
    markets,
    summary: summarize(items),
    headlines: headlines.length,
    items,
    ...(failed.length ? { error: `לא התקבלו: ${failed.join(", ")}` } : {}),
  };

  await saveSnapshot(snap);
  return snap;
}

// סבב אחד בכל פעם, גם אם כמה בקשות מגיעות יחד
export function runRefresh(): Promise<Snapshot> {
  if (!running) running = doRefresh().finally(() => (running = null));
  return running;
}
