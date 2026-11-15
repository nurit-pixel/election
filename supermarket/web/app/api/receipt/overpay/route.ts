import { NextRequest, NextResponse } from "next/server";
import { receiptOverpay } from "@/lib/overpay";

export const dynamic = "force-dynamic";

/** כמה שולם על המוצרים שבחשבונית לעומת סניף זול באזור. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items)
    ? body.items.map((i: { productId?: unknown; paid?: unknown }) => ({ productId: Number(i.productId), paid: Number(i.paid) }))
    : [];
  return NextResponse.json({ result: await receiptOverpay(items) });
}
