import Link from "next/link";
import { notFound } from "next/navigation";
import { storeBasket } from "@/lib/compare";
import { formatDistance, formatPrice, formatQuantity, formatUpdated } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const store = await storeBasket(Number((await params).id));
  if (!store) notFound();
  const b = store.basket;
  const missing = b.lines.filter((l) => !l.found);

  return (
    <div className="space-y-4">
      <Link href="/compare" className="text-sm text-emerald-700">
        → חזרה להשוואה
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold leading-snug">
          {store.chainName} · {store.name}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {[store.address, store.city].filter(Boolean).join(", ")}
          {store.distanceKm != null && ` · ${formatDistance(store.distanceKm)}`}
          {store.approximate && " (מיקום משוער)"}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            {b.complete ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                כל {b.itemCount} הפריטים נמצאו
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                נמצאו {b.foundCount} מתוך {b.itemCount}
              </span>
            )}
            {store.isPharm && <span className="mr-2 text-xs text-slate-500">רשת פארם – לא בדירוג</span>}
          </div>
          <div className="text-left">
            {b.savings > 0 && (
              <div className="text-sm text-slate-400 line-through tabular-nums">{formatPrice(b.regularTotal)}</div>
            )}
            <div className="text-2xl font-bold tabular-nums">{formatPrice(b.total)}</div>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-sm">
          {b.savings > 0 && <div className="text-emerald-700">חיסכון במבצעים: {formatPrice(b.savings)}</div>}
          {b.clubSavings > 0 && (
            <div className="text-violet-700">חיסכון אפשרי לחברי מועדון: עוד {formatPrice(b.clubSavings)}</div>
          )}
          {!store.hasPromos && <div className="text-xs text-slate-400">לסניף הזה לא נטענו מבצעים.</div>}
        </div>
      </div>

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {b.lines.map((l) =>
          l.found ? (
            <li key={l.itemId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug">{l.itemName}</div>
                  <Link href={`/product/${l.productId}`} className="block text-xs text-emerald-700">
                    {l.productName !== l.itemName ? l.productName : "גרף מחירים"}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {formatQuantity(l.quantity, l.isWeighted)} · {formatPrice(l.unitPrice)}
                    {l.isWeighted ? " לק״ג" : " ליחידה"}
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  {l.total < l.regularTotal && (
                    <div className="text-xs text-slate-400 line-through tabular-nums">{formatPrice(l.regularTotal)}</div>
                  )}
                  <div className="font-semibold tabular-nums">{formatPrice(l.total)}</div>
                </div>
              </div>
              {l.promo && (
                <div className="mt-1.5 inline-block rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                  מבצע{l.promo.clubName ? ` מועדון (${l.promo.clubName})` : ""}: {l.promo.description}
                </div>
              )}
              {l.clubOffer && (
                <div className="mt-1.5 rounded-lg bg-violet-50 px-2 py-1 text-xs text-violet-800">
                  לחברי {l.clubOffer.clubName ?? "מועדון"}: {l.clubOffer.description} – חיסכון של{" "}
                  {formatPrice(l.clubOffer.saving)}
                </div>
              )}
              {l.notes.map((note) => (
                <div key={note} className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  מבצע שלא חושב: {note}
                </div>
              ))}
              <div className={`mt-1 text-xs ${l.stale ? "text-amber-600" : "text-slate-400"}`}>
                עודכן {formatUpdated(l.fileTime)}
                {l.stale && " · מחיר ישן"}
              </div>
            </li>
          ) : null,
        )}
      </ul>

      {missing.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">לא נמצאו בסניף</h2>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-900">
            {missing.map((l) => (
              <li key={l.itemId}>
                {l.itemName} ({formatQuantity(l.quantity, l.isWeighted)})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
