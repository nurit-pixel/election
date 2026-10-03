import { NextResponse } from "next/server";
import { requireGroup, requirePlayer } from "@/lib/groupAuth";
import { joinGroup } from "@/lib/groups";

// הצטרפות: מי שיש לו את הקישור (או קבוצה פתוחה מהרשימה)
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = await requirePlayer();
  if (!p.ok) return p.res;
  const g = await requireGroup((await params).slug);
  if (!g.ok) return g.res;
  const { error } = await joinGroup(g.group.id, p.playerId);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true, slug: g.group.slug });
}
