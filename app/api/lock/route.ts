import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";

// נעל = עכשיו; פתח = עתיד רחוק; auto = חזרה ל-LOCK_AT
const FAR_FUTURE = "2100-01-01T00:00:00Z";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await req.json().catch(() => ({}));
  const lock_override =
    action === "lock" ? new Date().toISOString() : action === "open" ? FAR_FUTURE : action === "auto" ? null : undefined;
  if (lock_override === undefined) return NextResponse.json({ error: "bad action" }, { status: 400 });
  const { error } = await supabaseServer().from("results").upsert({ id: 1, lock_override });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true, lock_override });
}
