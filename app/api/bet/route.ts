import { NextResponse } from "next/server";
import { getPlayerId } from "@/lib/auth";
import { getBet, getResults, isLocked, lockAt } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase";
import { parseBet } from "@/lib/validate";
import { addHistory } from "@/lib/history";

export async function GET() {
  const playerId = await getPlayerId();
  if (!playerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [bet, results] = await Promise.all([getBet(playerId), getResults()]);
  return NextResponse.json({ bet, locked: isLocked(results), lockAt: lockAt(results) });
}

export async function POST(req: Request) {
  const playerId = await getPlayerId();
  if (!playerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isLocked(await getResults())) return NextResponse.json({ error: "locked" }, { status: 403 });

  const parsed = parseBet(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // upsert לפי player_id: עריכה חוזרת מעדכנת את אותה שורה; submitted_at נשמר מההגשה הראשונה
  const { error } = await supabaseServer()
    .from("bets")
    .upsert({ player_id: playerId, ...parsed.bet, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  await addHistory(playerId, parsed.bet);
  return NextResponse.json({ ok: true });
}
