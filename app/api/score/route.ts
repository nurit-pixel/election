import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { recomputeScores } from "@/lib/compute";

// חישוב ידני (גיבוי). בשגרה הניקוד מחושב אוטומטית בכל שמירת תוצאות ב-/api/results.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, count: await recomputeScores() });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
}
