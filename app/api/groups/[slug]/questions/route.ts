import { NextResponse } from "next/server";
import { requireGroup } from "@/lib/groupAuth";
import { supabaseServer } from "@/lib/supabase";
import { getResults, isLocked } from "@/lib/data";
import { getQuestions } from "@/lib/groups";
import { MAX_GROUP_QUESTIONS } from "@/lib/groupScore";

type Ctx = { params: Promise<{ slug: string }> };

// הגדרת שאלות הבונוס (בעלים, רק לפני הנעילה): { questions: string[] } — רשימה ריקה = חזרה לשאלות הכלליות
export async function PUT(req: Request, { params }: Ctx) {
  const g = await requireGroup((await params).slug, { manage: true });
  if (!g.ok) return g.res;
  if (isLocked(await getResults())) return NextResponse.json({ error: "locked" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const texts: string[] = Array.isArray(b.questions)
    ? b.questions.filter((t: unknown) => typeof t === "string").map((t: string) => t.trim().slice(0, 140)).filter(Boolean)
    : [];
  if (texts.length > MAX_GROUP_QUESTIONS) return NextResponse.json({ error: "too_many" }, { status: 400 });

  const db = supabaseServer();
  const existing = await getQuestions(g.group.id);
  // שאלה שהטקסט שלה לא השתנה שומרת על התשובות שכבר ניתנו
  const keep = new Map(existing.map((q) => [q.text, q]));
  const toDelete = existing.filter((q) => !texts.includes(q.text)).map((q) => q.id);
  if (toDelete.length) await db.from("group_questions").delete().in("id", toDelete);
  // סידור מחדש: קודם מזיזים את הנשארות למיקום זמני כדי לא להתנגש ב-unique(group_id, position)
  for (const q of existing.filter((q) => texts.includes(q.text))) {
    await db.from("group_questions").update({ position: 100 + q.position }).eq("id", q.id);
  }
  for (const [i, text] of texts.entries()) {
    const k = keep.get(text);
    if (k) await db.from("group_questions").update({ position: i + 1 }).eq("id", k.id);
    else await db.from("group_questions").insert({ group_id: g.group.id, position: i + 1, text });
  }
  return NextResponse.json({ questions: await getQuestions(g.group.id) });
}

// התשובות הנכונות (בעלים, בכל זמן — בדרך כלל אחרי התוצאות): { answers: { [questionId]: boolean | null } }
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await requireGroup((await params).slug, { manage: true });
  if (!g.ok) return g.res;
  const b = await req.json().catch(() => ({}));
  const ids = new Set((await getQuestions(g.group.id)).map((q) => q.id));
  const db = supabaseServer();
  for (const [id, v] of Object.entries(b.answers ?? {})) {
    if (!ids.has(id) || !(typeof v === "boolean" || v === null)) continue;
    await db.from("group_questions").update({ answer: v }).eq("id", id);
  }
  return NextResponse.json({ questions: await getQuestions(g.group.id) });
}
