import { NextRequest, NextResponse } from "next/server";
import { deleteSubscription, saveSubscription, validSubscription, vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** המפתח הציבורי שהדפדפן צריך כדי להירשם להתראות */
export async function GET() {
  return NextResponse.json({ publicKey: await vapidPublicKey() });
}

/** רישום המכשיר להתראות */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!validSubscription(body?.subscription)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await saveSubscription(body.subscription);
  return NextResponse.json({ ok: true });
}

/** ביטול ההתראות במכשיר */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint === "string") await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
