import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/log";
import { currentUserId } from "@/lib/session";
import { isSupportedType, matchLines, readReceipt, ReceiptError, RECEIPT_MAX_BYTES } from "@/lib/receipt";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** העלאת חשבונית: זיהוי טקסט בשרת והתאמת השורות למוצרים. לא מוסיף דבר לרשימה. */
export async function POST(req: NextRequest) {
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("לא התקבל קובץ.", 400);
  if (file.size > RECEIPT_MAX_BYTES) return fail("הקובץ גדול מדי (עד 10MB).", 413);
  if (!isSupportedType(file.type)) return fail("סוג הקובץ לא נתמך. מעלים תמונה (JPG / PNG) או PDF.", 415);

  try {
    const lines = await readReceipt(Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ lines: await matchLines(lines) });
  } catch (error) {
    const userId = await currentUserId();
    if (error instanceof ReceiptError) {
      await logEvent("error", "receipt_failed", `${file.type}, ${Math.round(file.size / 1024)}KB: ${error.message}`, { userId });
      return fail(error.message, error.status);
    }
    console.error("receipt: unexpected error", error);
    await logEvent("error", "receipt_failed", `${file.type}: ${error instanceof Error ? error.message : String(error)}`, { userId });
    return fail("קריאת החשבונית נכשלה. מנסים שוב בעוד רגע.", 500);
  }
}
