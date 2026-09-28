import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getResults, type BetRow } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase";
import { score } from "@/lib/scoring";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseServer();
  const results = await getResults();
  const { data: bets, error } = await db.from("bets").select("*");
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  const now = new Date().toISOString();
  const rows = (bets as BetRow[]).map((b) => ({ player_id: b.player_id, ...score(b, results), computed_at: now }));
  if (rows.length) {
    const up = await db.from("scores").upsert(rows, { onConflict: "player_id" });
    if (up.error) return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
