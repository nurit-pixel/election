import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";

// מחיקת קבוצה ע"י האדמין הראשי: { id }
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { error } = await supabaseServer().from("groups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
