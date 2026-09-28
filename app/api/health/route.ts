import { supabaseServer } from "@/lib/supabase";

// בדיקת חיים + אבחון הגדרות (בלי לחשוף ערכים): /api/health
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_CODE: !!process.env.ADMIN_CODE,
  };
  let db = "not checked";
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await supabaseServer().from("results").select("id").eq("id", 1).maybeSingle();
      db = error ? `error: ${error.message}` : data ? "ok" : "results row missing — run 001_init.sql";
    } catch (e) {
      db = `error: ${(e as Error).message}`;
    }
  }
  // Railway healthcheck צריך 200 גם כשה-DB לא מוגדר, כדי שהאבחון יהיה נגיש
  return Response.json({ ok: db === "ok", env, db });
}
