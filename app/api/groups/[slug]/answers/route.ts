import { NextResponse } from "next/server";
import { requireGroup } from "@/lib/groupAuth";
import { supabaseServer } from "@/lib/supabase";
import { getResults, isLocked } from "@/lib/data";
import { getQuestions } from "@/lib/groups";

// התשובות של החבר/ה לשאלות הקבוצה (עד הנעילה): { answers: { [questionId]: boolean } }
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const g = await requireGroup((await params).slug, { member: true });
  if (!g.ok) return g.res;
  if (!g.playerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isLocked(await getResults())) return NextResponse.json({ error: "locked" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const ids = new Set((await getQuestions(g.group.id)).map((q) => q.id));
  const rows = Object.entries(b.answers ?? {})
    .filter(([id, v]) => ids.has(id) && typeof v === "boolean")
    .map(([question_id, answer]) => ({ question_id, player_id: g.playerId!, answer, updated_at: new Date().toISOString() }));
  if (rows.length) {
    const { error } = await supabaseServer().from("group_answers").upsert(rows, { onConflict: "question_id,player_id" });
    if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
