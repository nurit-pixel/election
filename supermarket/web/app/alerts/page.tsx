import Link from "next/link";
import { revalidatePath } from "next/cache";
import { listAlerts, listTracked, markAlertsRead, type AlertRow } from "@/lib/tracking";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

async function markRead() {
  "use server";
  await markAlertsRead();
  revalidatePath("/", "layout");
}

const dayLabel = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;

export default async function AlertsPage() {
  const [alerts, tracked] = await Promise.all([listAlerts(), listTracked(30)]);
  const unread = alerts.filter((a) => !a.read).length;
  const days = [...new Set(alerts.map((a) => a.day))];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">התראות</h1>
          {unread > 0 && (
            <form action={markRead}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium">
                סימון הכול כנקרא ({unread})
              </button>
            </form>
          )}
        </div>
        <p className="text-sm text-slate-500">
          שינוי של 10% ומעלה במחיר הזול של מוצר ברשת, או ירידה אל מחיר היעד. רק למוצרים במעקב וברשימות שמורות.
        </p>
        {alerts.length === 0 && <p className="rounded-2xl bg-white p-4 text-slate-600">אין התראות עדיין.</p>}
        {days.map((day) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500">{dayLabel(day)}</h2>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {alerts
                .filter((a) => a.day === day)
                .map((a) => (
                  <AlertItem key={a.id} alert={a} />
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">מוצרים במעקב ({tracked.total})</h2>
        {tracked.total === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">
            אין מוצרים במעקב. אפשר להוסיף מדף המוצר (דרך החיפוש).
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
            {tracked.products.map((p) => (
              <li key={p.id}>
                <Link href={`/product/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="shrink-0 text-left tabular-nums">
                    {p.bestPrice != null ? formatPrice(p.bestPrice) : "–"}
                    {p.targetPrice != null && (
                      <span className="block text-xs text-slate-400">יעד {formatPrice(p.targetPrice)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {tracked.total > tracked.products.length && (
          <p className="text-xs text-slate-400">מוצגים {tracked.products.length} מתוך {tracked.total}.</p>
        )}
      </section>
    </div>
  );
}

function AlertItem({ alert: a }: { alert: AlertRow }) {
  const drop = a.kind === "target" || (a.pct ?? 0) < 0;
  return (
    <li>
      <Link href={`/product/${a.productId}`} className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            drop ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {a.kind === "target" ? "★" : drop ? "↓" : "↑"}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block leading-snug ${a.read ? "text-slate-600" : "font-semibold"}`}>{a.productName}</span>
          <span className="block text-xs text-slate-500">
            {a.chainName}
            {a.storeName && ` · ${a.storeName}`}
          </span>
          <span className="mt-0.5 block text-sm">
            {a.kind === "target" ? (
              <>
                ירד אל מחיר היעד ({formatPrice(a.targetPrice ?? a.newPrice)}): עכשיו <b>{formatPrice(a.newPrice)}</b>
              </>
            ) : (
              <>
                {drop ? "ירד" : "עלה"} ב-{Math.abs(a.pct ?? 0).toFixed(0)}%: {formatPrice(a.oldPrice ?? 0)} ←{" "}
                <b>{formatPrice(a.newPrice)}</b>
              </>
            )}
          </span>
        </span>
        {!a.read && <span aria-label="לא נקרא" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
      </Link>
    </li>
  );
}
