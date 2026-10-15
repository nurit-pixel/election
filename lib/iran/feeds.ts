import "server-only";
import type { Headline, LiveMarket, Quote } from "./types";

const UA = "Mozilla/5.0 (compatible; IranMeter/1.0)";
const TIMEOUT = 10_000;

// ---------- חדשות (RSS) ----------

const FEEDS: { url: string; source: string; filter: boolean }[] = [
  { url: "https://news.google.com/rss/search?q=%D7%90%D7%99%D7%A8%D7%90%D7%9F%20when%3A1d&hl=iw&gl=IL&ceid=IL:iw", source: "Google News (עברית)", filter: false },
  { url: "https://news.google.com/rss/search?q=site%3Aynet.co.il%20%D7%90%D7%99%D7%A8%D7%90%D7%9F%20when%3A2d&hl=iw&gl=IL&ceid=IL:iw", source: "ynet", filter: false },
  { url: "https://news.google.com/rss/search?q=Iran%20Israel%20when%3A1d&hl=en-US&gl=US&ceid=US:en", source: "Google News", filter: false },
  { url: "https://news.google.com/rss/search?q=Iran%20Hormuz%20OR%20Houthis%20OR%20Tehran%20when%3A1d&hl=en-US&gl=US&ceid=US:en", source: "Google News", filter: false },
  { url: "https://www.ynet.co.il/Integration/StoryRss2.xml", source: "ynet", filter: true },
  { url: "https://www.timesofisrael.com/feed/", source: "Times of Israel", filter: true },
];

const RELEVANT = /iran|tehran|khamenei|hormuz|houthi|irgc|hezbollah|איראן|טהרן|חמינאי|הורמוז|חות'?ים|חיזבאללה|משמרות המהפכה/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : null;
}

async function fetchFeed(f: (typeof FEEDS)[number]): Promise<Headline[]> {
  const res = await fetch(f.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(`${f.source} ${res.status}`);
  const xml = await res.text();
  const items = xml.split(/<item[\s>]/i).slice(1);
  return items
    .map((it) => {
      const title = tag(it, "title") ?? "";
      const link = tag(it, "link") ?? "";
      // ב-Google News שם המקור מופיע בתגית source
      const source = tag(it, "source") ?? f.source;
      return { title, link, source, published: tag(it, "pubDate") };
    })
    .filter((h) => h.title && h.link && (!f.filter || RELEVANT.test(h.title)));
}

export async function fetchHeadlines(maxAgeHours = 30): Promise<Headline[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const cutoff = Date.now() - maxAgeHours * 3600_000;
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const h of r.value) {
      const key = h.title.replace(/\s+-\s+[^-]+$/, "").slice(0, 80).toLowerCase();
      const t = h.published ? Date.parse(h.published) : NaN;
      if (seen.has(key) || (Number.isFinite(t) && t < cutoff)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  out.sort((a, b) => (Date.parse(b.published ?? "") || 0) - (Date.parse(a.published ?? "") || 0));
  return out.slice(0, 80);
}

// ---------- מחירים (Yahoo Finance) ----------

export const QUOTE_SYMBOLS: Record<string, string> = {
  brent: "BZ=F",
  wti: "CL=F",
  usdils: "ILS=X",
  ta35: "TA35.TA",
  eslt: "ESLT",
  gold: "GC=F",
};

async function fetchQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(`${symbol} ${res.status}`);
  const data = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketTime?: number } }[] };
  };
  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) throw new Error(`${symbol}: no price`);
  return {
    price,
    prevClose: typeof meta?.chartPreviousClose === "number" ? meta.chartPreviousClose : null,
    at: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
  };
}

export async function fetchQuotes(): Promise<Record<string, Quote>> {
  const entries = Object.entries(QUOTE_SYMBOLS);
  const results = await Promise.allSettled(entries.map(([, s]) => fetchQuote(s)));
  const out: Record<string, Quote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out[entries[i][0]] = r.value;
  });
  return out;
}

// ---------- Polymarket ----------

const GAMMA = "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=500&order=volume24hr&ascending=false";
const MATCH = /\biran|iranian|khamenei|tehran|hormuz\b/i;

type GammaMarket = {
  question?: string;
  slug?: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume24hr?: number;
  events?: { slug?: string }[];
};

function parseList(v: string | undefined): string[] {
  try {
    const arr = JSON.parse(v ?? "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export async function fetchPolymarket(): Promise<LiveMarket[]> {
  const res = await fetch(GAMMA, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(`polymarket ${res.status}`);
  const raw = (await res.json()) as GammaMarket[];
  return (Array.isArray(raw) ? raw : [])
    .filter((m) => m.question && m.slug && MATCH.test(m.question))
    .map((m) => {
      const outcomes = parseList(m.outcomes);
      const prices = parseList(m.outcomePrices).map(Number);
      const yesIdx = Math.max(0, outcomes.findIndex((o) => o.toLowerCase() === "yes"));
      return {
        question: m.question!,
        slug: m.slug!,
        yes: prices[yesIdx],
        endDate: m.endDate ?? null,
        volume24hr: m.volume24hr ?? 0,
        url: `https://polymarket.com/event/${m.events?.[0]?.slug ?? m.slug}`,
      };
    })
    .filter((m) => Number.isFinite(m.yes) && m.yes > 0 && m.yes < 1)
    .slice(0, 20);
}
