import { NextResponse } from "next/server";
import { requireGroup, requirePlayer } from "@/lib/groupAuth";
import { leaveGroup } from "@/lib/groups";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = await requirePlayer();
  if (!p.ok) return p.res;
  const g = await requireGroup((await params).slug);
  if (!g.ok) return g.res;
  if (g.group.owner_id === p.playerId) return NextResponse.json({ error: "owner_cannot_leave" }, { status: 400 });
  await leaveGroup(g.group.id, p.playerId);
  return NextResponse.json({ ok: true });
}
