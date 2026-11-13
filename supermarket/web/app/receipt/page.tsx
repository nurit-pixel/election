import Link from "next/link";
import { getList } from "@/lib/lists";
import { receiptEnabled } from "@/lib/receipt";
import { ReceiptImport } from "@/components/ReceiptImport";

export const dynamic = "force-dynamic";

export default async function ReceiptPage() {
  const list = await getList();
  return (
    <div className="space-y-4 pb-24">
      <div>
        <Link href="/" className="text-sm text-link">
          חזרה לרשימה
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold">הוספה מחשבונית</h1>
        <p className="mt-1 text-sm text-muted">
          מצלמים או מעלים חשבונית מהסופר. מזהים את המוצרים, מאשרים, והם נכנסים לרשימה ״{list.name}״.
        </p>
      </div>
      {receiptEnabled() ? (
        <ReceiptImport />
      ) : (
        <div className="rounded-pm-lg border border-aging/40 bg-aging-surface p-4 text-sm text-aging">
          <p className="font-bold">קריאת חשבוניות עוד לא הופעלה</p>
          <p className="mt-1">
            כדי להפעיל, מוסיפים לקובץ ‎.env בשרת את השורה <span dir="ltr">ANTHROPIC_API_KEY=...</span> ומפעילים מחדש.
            ההסבר המלא בקובץ DEPLOY.md.
          </p>
        </div>
      )}
    </div>
  );
}
