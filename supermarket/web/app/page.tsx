import { searchProducts, type ProductResult } from "@/lib/search";
import { formatPrice, formatUpdated } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  const results = q ? await searchProducts(q) : [];

  return (
    <div className="space-y-4">
      <form action="/" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          type="search"
          enterKeyHint="search"
          placeholder="שם מוצר או ברקוד"
          autoFocus={!q}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white active:bg-emerald-700">
          חיפוש
        </button>
      </form>

      {!q && (
        <p className="text-sm text-slate-500">
          אפשר לחפש לפי שם (למשל ״חלב תנובה 3%״) או להקליד ברקוד.
        </p>
      )}
      {q && results.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">לא נמצאו מוצרים עבור ״{q}״.</p>
      )}

      <ul className="space-y-3">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </ul>
    </div>
  );
}

function ProductCard({ product: p }: { product: ProductResult }) {
  const unit = p.isWeighted ? " לק״ג" : "";
  const cheapest = p.prices[0];
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{p.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {p.manufacturer && <span>{p.manufacturer} · </span>}
            <span dir="ltr">{p.barcode}</span>
            {p.internal && <span> · קוד פנימי של הרשת</span>}
            {p.isWeighted && <span> · מוצר שקיל</span>}
          </p>
        </div>
        {cheapest && (
          <div className="shrink-0 text-left">
            <div className="text-xl font-bold text-emerald-700">
              {formatPrice(cheapest.price)}
            </div>
            {unit && <div className="text-xs text-slate-500">{unit.trim()}</div>}
          </div>
        )}
      </div>

      {p.prices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">אין מחיר עדכני בסניפים שנטענו.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          {p.prices.map((s) => (
            <li key={s.storePk} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate">
                  {s.chainName} · {s.storeName}
                </div>
                <div className={`text-xs ${s.stale ? "text-amber-600" : "text-slate-400"}`}>
                  עודכן {formatUpdated(s.fileTime)}
                  {s.stale && " · לא עודכן לאחרונה"}
                </div>
              </div>
              <div className="shrink-0 font-semibold tabular-nums">
                {formatPrice(s.price)}
                {unit}
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
