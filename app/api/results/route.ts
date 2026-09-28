import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { PARTY_KEYS } from "@/lib/parties";
import { BONUS_KEYS } from "@/lib/copy";
import { validPm } from "@/lib/validate";
import { recomputeScores } from "@/lib/compute";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "bad body" }, { status: 400 });

  const seats: Record<string, number> = {};
  for (const k of PARTY_KEYS) {
    const v = b.seats?.[k];
    if (!Number.isInteger(v) || v < 0 || v > 120) return NextResponse.json({ error: `bad seats ${k}` }, { status: 400 });
    seats[k] = v;
  }
  const pm = b.pm === null || b.pm === "" ? null : b.pm;
  if (pm !== null && !validPm(pm)) return NextResponse.json({ error: "bad pm" }, { status: 400 });
  const bloc = b.bloc === "coalition" || b.bloc === "opposition" ? b.bloc : null;
  const bonus: Record<string, boolean | null> = {};
  for (const k of BONUS_KEYS) bonus[k] = typeof b.bonus?.[k] === "boolean" ? b.bonus[k] : null;
  if (!["none", "exit_poll", "official"].includes(b.mode)) return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const { error } = await supabaseServer()
    .from("results")
    .upsert({ id: 1, seats, pm, bloc, bonus, mode: b.mode, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  // חישוב ניקוד אוטומטי בכל שמירה
  try {
    return NextResponse.json({ ok: true, count: await recomputeScores() });
  } catch {
    return NextResponse.json({ error: "score" }, { status: 500 });
  }
}
