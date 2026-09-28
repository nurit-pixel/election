import { NextResponse } from "next/server";
import { getPlayerId, setPlayerCookie } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { normalizeName } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = normalizeName(body.name);
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const db = supabaseServer();
  let { data: player } = await db.from("players").select("id,name").eq("name", name).maybeSingle();

  if (player) {
    const current = await getPlayerId();
    if (current !== player.id) {
      const { count } = await db.from("bets").select("player_id", { count: "exact", head: true }).eq("player_id", player.id);
      if (count) return NextResponse.json({ error: "name_taken", name }, { status: 409 });
    }
  } else {
    const ins = await db.from("players").insert({ name }).select("id,name").single();
    if (ins.error) {
      // מרוץ על אותו שם — מישהו אחר נרשם באותו רגע
      if (ins.error.code === "23505") return NextResponse.json({ error: "name_taken", name }, { status: 409 });
      return NextResponse.json({ error: "db" }, { status: 500 });
    }
    player = ins.data;
  }

  await setPlayerCookie(player!.id);
  const { count } = await db.from("bets").select("player_id", { count: "exact", head: true }).eq("player_id", player!.id);
  return NextResponse.json({ player, hasBet: !!count });
}
