import { Quip } from "@/components/Quip";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageId } from "@/lib/ids";
import { storeBasket } from "@/lib/compare";
import { formatDistance, formatPrice, formatQuantity, formatUpdated } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const id = pageId((await params).id);
  const store = id == null ? null : await storeBasket(id);
  if (!store) notFound();
  const b = store.basket;
  const missing = b.lines.filter((l) => !l.found);

  return (
    <div className="space-y-4">
      <Link href="/compare" className="text-sm text-link">
        → חזרה להשוואה
      </Link>
      <div className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <h1 className="pm-h1-compact text-xl font-extrabold leading-snug">
          {store.chainName} · {store.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {[store.address, store.city].filter(Boolean).join(", ")}
          {store.distanceKm != null && ` · ${formatDistance(store.distanceKm)}`}
          {store.approximate && " (מיקום משוער)"}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            {b.complete ? (
              <span className="rounded-full bg-fresh-surface px-2.5 py-0.5 text-xs font-medium text-fresh">
                כל {b.itemCount} הפריטים נמצאו
              </span>
            ) : (
              <span className="rounded-full bg-aging-surface px-2.5 py-0.5 text-xs font-medium text-aging">
                נמצאו {b.foundCount} מתוך {b.itemCount}
              </span>
            )}
            {store.isPharm && <span className="mr-2 text-xs text-muted">רשת פארם – לא בדירוג</span>}
          </div>
          <div className="text-left">
            {b.savings > 0 && (
              <div className="text-sm text-muted line-through tabular-nums">{formatPrice(b.regularTotal)}</div>
            )}
            <div className="text-2xl font-bold tabular-nums">{formatPrice(b.total)}</div>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-sm">
          {b.savings > 0 && <div className="text-link">חיסכון במבצעים: {formatPrice(b.savings)}</div>}
          {b.clubSavings > 0 && (
            <div className="text-club">חיסכון אפשרי לחברי מועדון: עוד {formatPrice(b.clubSavings)}</div>
          )}
          {!store.hasPromos && <div className="text-xs text-muted">לסניף הזה לא נטענו מבצעים.</div>}
        </div>
      </div>

      <ul className="divide-y divide-subtle rounded-pm-lg border border-line bg-card shadow-card">
        {b.lines.map((l) =>
          l.found ? (
            <li key={l.itemId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug">{l.itemName}</div>
                  <Link href={`/product/${l.productId}`} className="block text-xs text-link">
                    {l.productName !== l.itemName ? l.productName : "גרף מחירים"}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatQuantity(l.quantity, l.isWeighted)} · {formatPrice(l.unitPrice)}
                    {l.isWeighted ? " לק״ג" : " ליחידה"}
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  {l.total < l.regularTotal && (
                    <div className="text-xs text-muted line-through tabular-nums">{formatPrice(l.regularTotal)}</div>
                  )}
                  <div className="font-semibold tabular-nums">{formatPrice(l.total)}</div>
                </div>
              </div>
              {l.promo && (
                <div className="mt-1.5 inline-block rounded-lg bg-fresh-surface px-2 py-1 text-xs text-fresh">
                  מבצע{l.promo.clubName ? ` מועדון (${l.promo.clubName})` : ""}: {l.promo.description}
                </div>
              )}
              {l.clubOffer && (
                <div className="mt-1.5 rounded-lg bg-club-surface px-2 py-1 text-xs text-club">
                  לחברי {l.clubOffer.clubName ?? "מועדון"}: {l.clubOffer.description} – חיסכון של{" "}
                  {formatPrice(l.clubOffer.saving)}
                </div>
              )}
              {l.notes.map((note) => (
                <div key={note} className="mt-1.5 rounded-lg bg-subtle px-2 py-1 text-xs text-muted">
                  מבצע שלא חושב: {note}
                </div>
              ))}
              <div className={`mt-1 text-xs ${l.stale ? "text-aging" : "text-muted"}`}>
                עודכן {formatUpdated(l.fileTime)}
                {l.stale && " · מחיר ישן"}
              </div>
            </li>
          ) : null,
        )}
      </ul>

      {missing.length > 0 && (
        <section className="rounded-pm-lg border border-aging/30 bg-aging-surface p-4">
          <h2 className="font-semibold text-aging">לא נמצאו בסניף</h2>
          <ul className="mt-1 list-inside list-disc text-sm text-aging">
            {missing.map((l) => (
              <li key={l.itemId}>
                {l.itemName} ({formatQuantity(l.quantity, l.isWeighted)})
              </li>
            ))}
          </ul>
        </section>
      )}
      <Quip place="store" />
    </div>
  );
}
