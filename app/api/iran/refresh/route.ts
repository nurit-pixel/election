import { latestSnapshot } from "@/lib/iran/store";
import { nextAllowedAt, runRefresh } from "@/lib/iran/refresh";

// סבב עדכון בלחיצה על "רענן" בדף. בין סבבים יש המתנה (IRAN_COOLDOWN_MIN), כדי שלחיצות חוזרות
// לא יפעילו את Claude שוב ושוב. מי ששולח x-cron-secret נכון עוקף את ההמתנה.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.IRAN_CRON_SECRET?.trim();
  const forced = !!secret && req.headers.get("x-cron-secret") === secret;
  try {
    if (!forced) {
      const wait = nextAllowedAt(await latestSnapshot());
      if (wait) return Response.json({ ok: true, skipped: true, nextAllowedAt: wait }, { status: 429 });
    }
    const s = await runRefresh();
    return Response.json({ ok: !s.error, skipped: false, createdAt: s.createdAt, headlines: s.headlines, error: s.error ?? null });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
