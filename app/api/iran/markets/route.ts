import { fetchPolymarket } from "@/lib/iran/feeds";

// שווקים פתוחים ב-Polymarket על איראן, עבור מד ההסלמה (/iran). מטמון של 10 דקות.
export const revalidate = 600;

export async function GET() {
  try {
    const markets = await fetchPolymarket();
    return Response.json({ markets, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ markets: [], error: (e as Error).message }, { status: 502 });
  }
}
