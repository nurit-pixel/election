import { NextResponse } from "next/server";
import { setPlayerCookie } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { normalizeName } from "@/lib/validate";
import { hashPin, LOCK_MINUTES, MAX_FAILED, PIN_RE, verifyPin, weakPin } from "@/lib/pin";

// כניסה: { name, pin, create? }
// - שם לא קיים: 404 not_found, אלא אם create=true → נוצר משתמש חדש עם הקוד
// - שם קיים בלי קוד (שחקן ותיק מלפני הקודים): הקוד שהוקלד נקבע כקוד שלו
// - שם קיים עם קוד: אימות; 5 טעויות → חסימה ל-15 דקות
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = normalizeName(body.name);
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  if (!PIN_RE.test(pin)) return NextResponse.json({ error: "bad_pin_format" }, { status: 400 });

  const db = supabaseServer();
  const { data: found, error } = await db
    .from("players")
    .select("id,name,pin_hash,failed_attempts,locked_until")
    .ilike("name", escapeLike(name))
    .maybeSingle();
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  let player: { id: string; name: string };
  let status: "new" | "claimed" | "ok";

  if (!found) {
    if (!body.create) return NextResponse.json({ error: "not_found", name }, { status: 404 });
    if (weakPin(pin)) return NextResponse.json({ error: "weak_pin" }, { status: 400 });
    const ins = await db.from("players").insert({ name, pin_hash: hashPin(pin) }).select("id,name").single();
    if (ins.error) {
      const taken = ins.error.code === "23505";
      return NextResponse.json({ error: taken ? "name_taken" : "db" }, { status: taken ? 409 : 500 });
    }
    player = ins.data;
    status = "new";
  } else {
    if (found.locked_until && new Date(found.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ error: "locked", until: found.locked_until }, { status: 429 });
    }
    if (!found.pin_hash) {
      if (weakPin(pin)) return NextResponse.json({ error: "weak_pin" }, { status: 400 });
      await db.from("players").update({ pin_hash: hashPin(pin), failed_attempts: 0, locked_until: null }).eq("id", found.id);
      status = "claimed";
    } else if (!verifyPin(pin, found.pin_hash)) {
      const fails = (found.failed_attempts ?? 0) + 1;
      const lock = fails >= MAX_FAILED;
      await db
        .from("players")
        .update({
          failed_attempts: lock ? 0 : fails,
          locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
        })
        .eq("id", found.id);
      return NextResponse.json(
        { error: lock ? "locked" : "bad_pin", left: lock ? 0 : MAX_FAILED - fails },
        { status: lock ? 429 : 401 },
      );
    } else {
      if (found.failed_attempts) await db.from("players").update({ failed_attempts: 0 }).eq("id", found.id);
      status = "ok";
    }
    player = { id: found.id, name: found.name };
  }

  await setPlayerCookie(player.id);
  const { count } = await db.from("bets").select("player_id", { count: "exact", head: true }).eq("player_id", player.id);
  return NextResponse.json({ player, status, hasBet: !!count });
}
