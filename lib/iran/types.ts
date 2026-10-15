export type Effect = "up" | "down" | "mix" | "info";

export type NewsItem = {
  d: string; // תאריך לתצוגה, למשל "14.10"
  s: string; // מקור
  t: string; // כותרת בעברית
  b: string; // תקציר בעברית
  e: Effect;
  ind: string | null; // מזהה האינדיקטור שהידיעה הזיזה
  u: string; // קישור
  at?: string; // מתי נוספה (ISO)
};

export type IndicatorStatus = { text: string; src: [string, string][]; at: string; reason: string };

export type Quote = { price: number; prevClose: number | null; at: string };

export type LiveMarket = { question: string; slug: string; yes: number; endDate: string | null; volume24hr: number; url: string };

export type Snapshot = {
  createdAt: string;
  values: Record<string, number>;
  status: Record<string, IndicatorStatus>;
  news: NewsItem[];
  quotes: Record<string, Quote>;
  markets: LiveMarket[];
  summary: string;
  headlines: number; // כמה כותרות נבדקו בסבב
  model: string | null;
  error?: string;
};

export type Headline = { title: string; link: string; source: string; published: string | null };
