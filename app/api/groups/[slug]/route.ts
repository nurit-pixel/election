import { NextResponse } from "next/server";
import { requireGroup } from "@/lib/groupAuth";
import { supabaseServer } from "@/lib/supabase";
import { GROUP_COLORS, GROUP_EMOJIS } from "@/lib/groupScore";

type Ctx = { params: Promise<{ slug: string }> };

// עדכון הגדרות (בעלים): { name?, emoji?, color?, is_public? }
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await requireGroup((await params).slug, { manage: true });
  if (!g.ok) return g.res;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (GROUP_EMOJIS.includes(b.emoji)) patch.emoji = b.emoji;
  if (GROUP_COLORS.includes(b.color)) patch.color = b.color;
  if (typeof b.is_public === "boolean") patch.is_public = b.is_public;
  const { data, error } = await supabaseServer().from("groups").update(patch).eq("id", g.group.id).select("*").single();
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ group: data });
}

// מחיקת קבוצה (בעלים). ההימורים של החברים לא נפגעים.
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await requireGroup((await params).slug, { manage: true });
  if (!g.ok) return g.res;
  const { error } = await supabaseServer().from("groups").delete().eq("id", g.group.id);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
