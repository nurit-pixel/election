import { NextResponse } from "next/server";
import { clearPlayerCookie } from "@/lib/auth";

// יציאה / החלפת משתמש (למשל בטלפון משותף)
export async function POST() {
  await clearPlayerCookie();
  return NextResponse.json({ ok: true });
}
