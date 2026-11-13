import { NextRequest, NextResponse } from "next/server";
import { isSupportedType, matchLines, readReceipt, receiptEnabled, ReceiptError, RECEIPT_MAX_BYTES } from "@/lib/receipt";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** העלאת חשבונית: קריאה בעזרת Claude והתאמת השורות למוצרים. לא מוסיף דבר לרשימה. */
export async function POST(req: NextRequest) {
  if (!receiptEnabled()) return fail("קריאת חשבוניות לא הופעלה: חסר ANTHROPIC_API_KEY בקובץ ‎.env בשרת.", 503);

  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("לא התקבל קובץ.", 400);
  if (file.size > RECEIPT_MAX_BYTES) return fail("הקובץ גדול מדי (עד 10MB).", 413);
  if (!isSupportedType(file.type)) return fail("סוג הקובץ לא נתמך. מעלים תמונה (JPG / PNG) או PDF.", 415);

  try {
    const lines = await readReceipt(Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ lines: await matchLines(lines) });
  } catch (error) {
    if (error instanceof ReceiptError) return fail(error.message, error.status);
    console.error("receipt: unexpected error", error);
    return fail("קריאת החשבונית נכשלה. מנסים שוב בעוד רגע.", 500);
  }
}
