import { NextResponse } from "next/server";
import { setPlayerCookie } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { normalizeName } from "@/lib/validate";

// כניסה לפי שם: שם חדש יוצר שחקן, שם קיים מחזיר אותו — כך אפשר לחזור ולעדכן את ההימור מכל מכשיר
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = normalizeName(body.name);
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const db = supabaseServer();
  let { data: player } = await db.from("players").select("id,name").eq("name", name).maybeSingle();
  let isNew = false;

  if (!player) {
    const ins = await db.from("players").insert({ name }).select("id,name").single();
    if (ins.error?.code === "23505") {
      // מרוץ: מישהו נרשם באותו שם באותו רגע — פשוט נכנסים אליו
      ({ data: player } = await db.from("players").select("id,name").eq("name", name).maybeSingle());
    } else if (ins.error) {
      return NextResponse.json({ error: "db" }, { status: 500 });
    } else {
      player = ins.data;
      isNew = true;
    }
  }
  if (!player) return NextResponse.json({ error: "db" }, { status: 500 });

  await setPlayerCookie(player.id);
  const { count } = await db.from("bets").select("player_id", { count: "exact", head: true }).eq("player_id", player.id);
  return NextResponse.json({ player, hasBet: !!count, isNew });
}
