import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getHistory } from "@/lib/history";

// היסטוריית הגשות של שחקן (אדמין בלבד): GET /api/players/history?id=<player_id>
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json(await getHistory(id));
}
