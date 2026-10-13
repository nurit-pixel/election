// שווקים פתוחים ב-Polymarket על איראן/ישראל, עבור מד ההסלמה (/iran)
// הדפדפן לא יכול לפנות ל-Polymarket ישירות (CORS), אז השרת מושך ומסנן. מטמון של 10 דקות.
export const revalidate = 600;

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

export async function GET() {
  try {
    const res = await fetch(GAMMA, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ markets: [], error: `polymarket ${res.status}` }, { status: 502 });
    const raw = (await res.json()) as GammaMarket[];
    const markets = (Array.isArray(raw) ? raw : [])
      .filter((m) => m.question && m.slug && MATCH.test(m.question))
      .map((m) => {
        const outcomes = parseList(m.outcomes);
        const prices = parseList(m.outcomePrices).map(Number);
        const yesIdx = Math.max(0, outcomes.findIndex((o) => o.toLowerCase() === "yes"));
        const eventSlug = m.events?.[0]?.slug ?? m.slug;
        return {
          question: m.question!,
          slug: m.slug!,
          yes: prices[yesIdx],
          endDate: m.endDate ?? null,
          volume24hr: m.volume24hr ?? 0,
          url: `https://polymarket.com/event/${eventSlug}`,
        };
      })
      .filter((m) => Number.isFinite(m.yes) && m.yes > 0 && m.yes < 1)
      .slice(0, 20);
    return Response.json({ markets, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ markets: [], error: (e as Error).message }, { status: 502 });
  }
}
