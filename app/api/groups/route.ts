import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/groupAuth";
import { createGroup } from "@/lib/groups";
import { GROUP_COLORS, GROUP_EMOJIS } from "@/lib/groupScore";

// יצירת קבוצה: { name, emoji, color, is_public }
export async function POST(req: Request) {
  const auth = await requirePlayer();
  if (!auth.ok) return auth.res;
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  const group = await createGroup({
    owner: auth.playerId,
    name,
    emoji: GROUP_EMOJIS.includes(b.emoji) ? b.emoji : GROUP_EMOJIS[0],
    color: GROUP_COLORS.includes(b.color) ? b.color : GROUP_COLORS[0],
    is_public: !!b.is_public,
  });
  return NextResponse.json({ group });
}
