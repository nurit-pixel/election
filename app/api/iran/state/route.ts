import { history, latestSnapshot } from "@/lib/iran/store";
import { COOLDOWN_MIN, isRunning, nextAllowedAt } from "@/lib/iran/refresh";

// מצב שמור למד ההסלמה (/iran): תמונת המצב האחרונה, היסטוריה, ומתי מותר לרענן שוב
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const last = await latestSnapshot();
    const points = await history(14);
    return Response.json({
      snapshot: last,
      history: points,
      cooldownMin: COOLDOWN_MIN,
      nextAllowedAt: nextAllowedAt(last),
      refreshing: isRunning(),
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ snapshot: null, history: [], error: (e as Error).message }, { status: 500 });
  }
}
