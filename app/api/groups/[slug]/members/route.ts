import { NextResponse } from "next/server";
import { requireGroup } from "@/lib/groupAuth";
import { leaveGroup } from "@/lib/groups";

// הסרת חבר/ה (בעלים): { playerId }
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const g = await requireGroup((await params).slug, { manage: true });
  if (!g.ok) return g.res;
  const { playerId } = await req.json().catch(() => ({}));
  if (typeof playerId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (playerId === g.group.owner_id) return NextResponse.json({ error: "cannot_remove_owner" }, { status: 400 });
  await leaveGroup(g.group.id, playerId);
  return NextResponse.json({ ok: true });
}
