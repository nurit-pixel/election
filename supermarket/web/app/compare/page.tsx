import Link from "next/link";
import { compareStores, type RankedStore } from "@/lib/compare";
import { formatDistance, formatPrice, formatUpdated } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const { list, ranked, storesInRadius } = await compareStores();
  const complete = ranked.filter((s) => s.basket.complete);
  const partial = ranked.filter((s) => !s.basket.complete);
  const cheapest = complete[0]?.basket.total;

  if (list.items.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-4 text-slate-600">
        הרשימה ריקה.{" "}
        <Link href="/" className="text-emerald-700 underline">
          הוסיפו מוצרים
        </Link>{" "}
        כדי להשוות סניפים.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">השוואת סניפים</h1>
        <p className="text-sm text-slate-500">
          {list.items.length} פריטים · {storesInRadius} סניפים ברדיוס · המחירים לפני מבצעים
        </p>
      </div>

      {storesInRadius === 0 && (
        <p className="rounded-2xl bg-white p-4 text-slate-600">
          אין סניפים עם מחירים ברדיוס.{" "}
          <Link href="/settings" className="text-emerald-700 underline">
            הוסיפו כתובת בהגדרות
          </Link>
          .
        </p>
      )}

      {complete.length > 0 && (
        <ol className="space-y-2">
          {complete.map((s, i) => (
            <StoreRow key={s.storePk} store={s} rank={i + 1} diff={i === 0 ? null : s.basket.total - cheapest!} />
          ))}
        </ol>
      )}

      {partial.length > 0 && (
        <section className="space-y-2">
          <h2 className="pt-2 text-sm font-semibold text-slate-600">
            {complete.length > 0 ? "סניפים שחסרים בהם פריטים" : "באף סניף אין את כל הפריטים"}
          </h2>
          <ul className="space-y-2">
            {partial.map((s) => (
              <StoreRow key={s.storePk} store={s} rank={null} diff={null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StoreRow({ store: s, rank, diff }: { store: RankedStore; rank: number | null; diff: number | null }) {
  const b = s.basket;
  return (
    <li>
      <Link
        href={`/store/${s.storePk}`}
        className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm ${
          rank === 1 ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200"
        }`}
      >
        {rank != null && (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              rank === 1 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">
            {s.chainName} · {s.name}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {[s.address, s.city].filter(Boolean).join(", ")}
            {s.distanceKm != null && ` · ${formatDistance(s.distanceKm)}`}
            {s.approximate && " (מיקום משוער)"}
          </div>
          {!b.complete && (
            <div className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              נמצאו {b.foundCount} מתוך {b.itemCount}
            </div>
          )}
          {s.pricesFileTime && (
            <div className={`mt-1 text-xs ${b.stale ? "text-amber-600" : "text-slate-400"}`}>
              עודכן {formatUpdated(s.pricesFileTime)}
              {b.stale && " · מחירים ישנים"}
            </div>
          )}
        </div>
        <div className="shrink-0 text-left">
          <div className={`text-lg font-bold tabular-nums ${b.complete ? "text-slate-900" : "text-slate-500"}`}>
            {formatPrice(b.total)}
          </div>
          {diff != null && diff > 0 && <div className="text-xs text-rose-600">+{formatPrice(diff)}</div>}
          {!b.complete && <div className="text-xs text-slate-400">סל חלקי</div>}
        </div>
      </Link>
    </li>
  );
}
