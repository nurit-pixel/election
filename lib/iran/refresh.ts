import "server-only";
import seed from "./seed.json";
import { assess } from "./assess";
import { fetchHeadlines, fetchPolymarket, fetchQuotes } from "./feeds";
import { latestSnapshot, saveSnapshot } from "./store";
import type { NewsItem, Snapshot } from "./types";

export const INTERVAL_MIN = 60;

let running: Promise<Snapshot> | null = null;

export function nextUpdateAt(last: Snapshot | null): string {
  const base = last ? Date.parse(last.createdAt) : Date.now();
  return new Date(base + INTERVAL_MIN * 60_000).toISOString();
}

export function isStale(last: Snapshot | null, graceMin = 5): boolean {
  if (!last) return true;
  return Date.now() - Date.parse(last.createdAt) > (INTERVAL_MIN + graceMin) * 60_000;
}

function seedValues(): Record<string, number> {
  return Object.fromEntries(seed.indicators.filter((i) => !i.computed).map((i) => [i.id, i.v]));
}

async function doRefresh(): Promise<Snapshot> {
  const now = new Date();
  const prev = await latestSnapshot().catch(() => null);
  const [headlines, quotes, markets] = await Promise.all([
    fetchHeadlines().catch(() => []),
    fetchQuotes().catch(() => ({})),
    fetchPolymarket().catch(() => []),
  ]);

  const values = { ...seedValues(), ...(prev?.values ?? {}) };
  const status = prev?.status ?? {};
  const recentNews: NewsItem[] = prev?.news ?? (seed.news as NewsItem[]);

  const snap: Snapshot = {
    createdAt: now.toISOString(),
    values,
    status,
    news: recentNews,
    quotes,
    markets,
    summary: prev?.summary ?? "",
    headlines: headlines.length,
    model: null,
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    snap.error = "ANTHROPIC_API_KEY לא מוגדר: מחירים ושווקים מתעדכנים, אינדיקטורים וידיעות לא";
  } else if (headlines.length) {
    try {
      const a = await assess({ values, status, recentNews, headlines, quotes, now });
      snap.values = a.values;
      snap.status = a.status;
      const known = new Set(recentNews.map((n) => n.u));
      snap.news = [...a.news.filter((n) => !known.has(n.u)), ...recentNews].slice(0, 40);
      snap.summary = a.summary || snap.summary;
      snap.model = a.model;
    } catch (e) {
      snap.error = `הערכה נכשלה: ${(e as Error).message}`;
    }
  }

  await saveSnapshot(snap);
  return snap;
}

// סבב אחד בכל פעם, גם אם כמה בקשות מגיעות יחד
export function runRefresh(): Promise<Snapshot> {
  if (!running) running = doRefresh().finally(() => (running = null));
  return running;
}
