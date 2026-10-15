import "server-only";
import seed from "./seed.json";
import { assess } from "./assess";
import { fetchHeadlines, fetchPolymarket, fetchQuotes } from "./feeds";
import { latestSnapshot, saveSnapshot } from "./store";
import type { NewsItem, Snapshot } from "./types";

// עדכון רק בלחיצה על "רענן". כדי שלחיצות חוזרות לא יעלו כסף, יש המתנה בין סבבים
export const COOLDOWN_MIN = Number(process.env.IRAN_COOLDOWN_MIN) || 10;

let running: Promise<Snapshot> | null = null;

export function nextAllowedAt(last: Snapshot | null): string | null {
  if (!last) return null;
  const t = Date.parse(last.createdAt) + COOLDOWN_MIN * 60_000;
  return t > Date.now() ? new Date(t).toISOString() : null;
}

export function isRunning(): boolean {
  return running !== null;
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
