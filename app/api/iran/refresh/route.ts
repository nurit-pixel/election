import { runRefresh } from "@/lib/iran/refresh";

// הפעלה ידנית או מ-cron חיצוני של סבב עדכון: POST /api/iran/refresh עם הכותרת x-cron-secret
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.IRAN_CRON_SECRET?.trim();
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const s = await runRefresh();
    return Response.json({ ok: !s.error, createdAt: s.createdAt, headlines: s.headlines, error: s.error ?? null });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
