import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { normalizeName } from "@/lib/validate";
import { recomputeScores } from "@/lib/compute";
import { listPlayers } from "@/lib/players";

// ניהול שחקנים (אדמין בלבד): רשימה, שינוי שם, איפוס הימור, מחיקה

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ players: await listPlayers() });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
}

// שינוי שם: { id, name }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, name: raw } = await req.json().catch(() => ({}));
  const name = normalizeName(raw);
  if (typeof id !== "string" || !name) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { error } = await supabaseServer().from("players").update({ name }).eq("id", id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "name_taken" }, { status: 409 });
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}

// מחיקה: { id, betOnly?: true } — betOnly מאפס רק את ההימור והניקוד; השחקן נשאר
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, betOnly } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = supabaseServer();
  const res = betOnly
    ? await Promise.all([db.from("bets").delete().eq("player_id", id), db.from("scores").delete().eq("player_id", id)])
    : [await db.from("players").delete().eq("id", id)]; // bets/scores נמחקים ב-cascade
  if (res.some((r) => r.error)) return NextResponse.json({ error: "db" }, { status: 500 });
  await recomputeScores().catch(() => {});
  return NextResponse.json({ ok: true });
}
