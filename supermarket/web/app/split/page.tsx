import Link from "next/link";
import { compareSplits, type StoreInfo } from "@/lib/compare";
import type { StoreBasket } from "@/lib/basket";
import type { SplitOffer } from "@/lib/split";
import { formatDistance, formatPrice, formatQuantity } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SplitPage() {
  const { list, bestSingle, offers, minSaving, storesChecked } = await compareSplits();

  return (
    <div className="space-y-4">
      <Link href="/compare" className="text-sm text-link">
        → חזרה להשוואה
      </Link>
      <div>
        <h1 className="text-lg font-bold">פיצול לשני סניפים</h1>
        <p className="text-sm text-muted">
          {list.items.length} פריטים · נבדקו כל הזוגות מבין {storesChecked} הסניפים הקרובים · כל פריט בסניף שבו הוא
          זול יותר
        </p>
      </div>

      {bestSingle && (
        <div className="rounded-pm-lg border border-line bg-card p-4 text-sm shadow-card">
          <div className="text-muted">הסל הזול ביותר בסניף אחד</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <Link href={`/store/${bestSingle.storePk}`} className="font-semibold text-link">
              {bestSingle.chainName} · {bestSingle.name}
            </Link>
            <div className="shrink-0 font-bold tabular-nums">{formatPrice(bestSingle.basket.total)}</div>
          </div>
          {!bestSingle.basket.complete && (
            <div className="mt-1 text-xs text-aging">
              נמצאו {bestSingle.basket.foundCount} מתוך {bestSingle.basket.itemCount}
            </div>
          )}
        </div>
      )}

      {offers.length === 0 ? (
        <p className="rounded-pm-lg bg-card p-4 text-muted">
          {list.items.length === 0
            ? "הרשימה ריקה."
            : `אין פיצול שחוסך לפחות ${formatPrice(minSaving)} לעומת קנייה בסניף אחד. `}
          {list.items.length > 0 && (
            <Link href="/settings" className="text-link underline">
              שינוי הסף בהגדרות
            </Link>
          )}
        </p>
      ) : (
        <ol className="space-y-4">
          {offers.map((offer, index) => (
            <OfferCard key={`${offer.a.storePk}-${offer.b.storePk}`} offer={offer} first={index === 0} />
          ))}
        </ol>
      )}
    </div>
  );
}

function OfferCard({ offer, first }: { offer: SplitOffer<StoreInfo>; first: boolean }) {
  return (
    <li className={`rounded-pm-lg border bg-card shadow-card ${first ? "border-info/40 ring-1 ring-info/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          {offer.saving != null ? (
            <div className="font-semibold text-link">חיסכון של {formatPrice(offer.saving)}</div>
          ) : (
            <div className="font-semibold text-info">
              נמצאו {offer.foundCount} מתוך {offer.itemCount} פריטים
            </div>
          )}
          <div className="text-xs text-muted">לעומת הסל הזול בסניף אחד</div>
        </div>
        <div className="text-xl font-bold tabular-nums">{formatPrice(offer.total)}</div>
      </div>
      <StoreHalf store={offer.a} basket={offer.basketA} />
      <StoreHalf store={offer.b} basket={offer.basketB} />
      {offer.missing.length > 0 && (
        <div className="border-t border-aging/30 bg-aging-surface p-4 text-sm text-aging">
          לא נמצאו באף אחד מהשניים: {offer.missing.map((i) => i.name).join(", ")}
        </div>
      )}
    </li>
  );
}

function StoreHalf({ store, basket }: { store: StoreInfo; basket: StoreBasket }) {
  return (
    <div className="border-t border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold leading-snug">
            {store.chainName} · {store.name}
          </div>
          <div className="text-xs text-muted">
            {[store.address, store.city].filter(Boolean).join(", ")}
            {store.distanceKm != null && ` · ${formatDistance(store.distanceKm)}`}
            {store.approximate && " (מיקום משוער)"}
          </div>
        </div>
        <div className="shrink-0 font-semibold tabular-nums">{formatPrice(basket.total)}</div>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {basket.lines.map((l) =>
          l.found ? (
            <li key={l.itemId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {l.itemName} <span className="text-xs text-muted">{formatQuantity(l.quantity, l.isWeighted)}</span>
                {l.promo && <span className="mr-1 text-xs text-link">· מבצע</span>}
                {l.stale && <span className="mr-1 text-xs text-aging">· מחיר ישן</span>}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{formatPrice(l.total)}</span>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
