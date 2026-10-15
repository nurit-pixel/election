import { history, latestSnapshot } from "@/lib/iran/store";
import { INTERVAL_MIN, isStale, nextUpdateAt, runRefresh } from "@/lib/iran/refresh";

// מצב חי למד ההסלמה (/iran): תמונת המצב האחרונה, היסטוריה, ומתי העדכון הבא
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const last = await latestSnapshot();
    // גיבוי לתזמון: אם עבר יותר משעה ומשהו מהעדכון האחרון, מתחילים סבב ברקע
    const refreshing = isStale(last);
    if (refreshing) void runRefresh().catch(() => {});
    const points = await history(14);
    return Response.json({
      snapshot: last,
      history: points,
      intervalMin: INTERVAL_MIN,
      nextUpdateAt: refreshing ? new Date(Date.now() + 2 * 60_000).toISOString() : nextUpdateAt(last),
      refreshing,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ snapshot: null, history: [], error: (e as Error).message }, { status: 500 });
  }
}
