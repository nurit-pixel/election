import { NextResponse } from "next/server";
import { checkAdminCode, setAdminCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkAdminCode(body.code)) return NextResponse.json({ error: "bad_code" }, { status: 401 });
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
