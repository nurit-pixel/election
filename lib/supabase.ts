import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let server: SupabaseClient | null = null;

// לקוח שרת עם service role. לשימוש רק ב-API routes ובקומפוננטות שרת.
export function supabaseServer(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("supabaseServer() is server-only");
  if (!server) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return server;
}

// לקוח דפדפן עם anon key. כל הטבלאות חסומות ל-anon, אז בפועל לא בשימוש — קיים לשלמות.
export function supabaseBrowser(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
