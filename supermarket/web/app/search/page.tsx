import { Quip } from "@/components/Quip";
import { cheapestFirst } from "@/lib/order";
import Link from "next/link";
import { searchProducts, type ProductResult } from "@/lib/search";
import { getItem, type ListItem } from "@/lib/lists";
import { formatPrice, formatUpdated } from "@/lib/format";
import { SearchBar } from "@/components/SearchBar";
import { addProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; item?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const item = params.item ? await getItem(Number(params.item)) : null;
  // ההצעה הזולה ביותר למעלה
  const results = q ? cheapestFirst(await searchProducts(q)) : [];

  return (
    <div className="space-y-4">
      {item ? (
        <div className="rounded-pm bg-fresh-surface p-3 text-sm text-fresh">
          בוחרים חלופה לפריט <b>{item.name}</b>
          {item.isWeighted ? " (מוצר שקיל)" : ""}.{" "}
          <Link href="/" className="underline">
            חזרה לרשימה
          </Link>
        </div>
      ) : (
        <h1 className="text-lg font-bold">הוספת מוצר</h1>
      )}
      <SearchBar query={q} itemId={item?.id} autoFocus={!q} />

      {q && results.length === 0 && (
        <div className="space-y-2 rounded-pm bg-card p-4 text-muted">
          <p>לא נמצאו מוצרים עבור ״{q}״.</p>
          <Quip place="searchEmpty" />
        </div>
      )}
      {results.length > 1 && (
        <div className="space-y-1">
          <p className="text-sm font-bold">{results.length} תוצאות, מהזול ליקר</p>
          <Quip place="search" />
        </div>
      )}
      <ul className="space-y-3">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ProductCard({ product: p, item }: { product: ProductResult; item: ListItem | null }) {
  const unit = p.isWeighted ? " לק״ג" : "";
  const cheapest = p.prices[0];
  const priciest = p.prices[p.prices.length - 1];
  const already = item?.products.some((x) => x.id === p.id);
  const wrongKind = item != null && item.isWeighted !== p.isWeighted;

  return (
    <li className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">
            <Link href={`/product/${p.id}`} className="underline-offset-2 hover:underline">
              {p.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {p.manufacturer && <span>{p.manufacturer} · </span>}
            <span dir="ltr">{p.barcode}</span>
            {p.chainName && <span> · רק ב{p.chainName}</span>}
            {p.isWeighted && <span> · מוצר שקיל</span>}
          </p>
        </div>
        {cheapest && (
          <div className="shrink-0 text-left">
            <div className="text-lg font-bold text-link">
              {formatPrice(cheapest.price)}
              {priciest.price !== cheapest.price && (
                <span className="text-sm font-normal text-muted"> – {formatPrice(priciest.price)}</span>
              )}
            </div>
            {unit && <div className="text-xs text-muted">{unit.trim()}</div>}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {already ? (
          <span className="text-sm text-muted">כבר בין החלופות</span>
        ) : wrongKind ? (
          <span className="text-sm text-muted">
            {item!.isWeighted ? "אפשר להוסיף רק מוצר שקיל" : "אי אפשר לשלב מוצר שקיל עם מוצר ארוז"}
          </span>
        ) : (
          <form action={addProduct}>
            <input type="hidden" name="product" value={p.id} />
            {item && <input type="hidden" name="item" value={item.id} />}
            <button className="rounded-pm bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              {item ? "הוספה כחלופה" : "הוספה לרשימה"}
            </button>
          </form>
        )}
        <Link href={`/product/${p.id}`} className="text-xs text-link">
          גרף ומעקב · {p.prices.length} סניפים
        </Link>
      </div>

      {p.prices.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none text-link">מחירים לפי סניף</summary>
          <ul className="mt-2 divide-y divide-subtle border-t border-subtle">
            {p.prices.map((s) => (
              <li key={s.storePk} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate">
                    {s.chainName} · {s.storeName}
                  </div>
                  <div className={`text-xs ${s.stale ? "text-aging" : "text-muted"}`}>
                    עודכן {formatUpdated(s.fileTime)}
                    {s.stale && " · מחיר ישן"}
                  </div>
                </div>
                <div className="shrink-0 font-semibold tabular-nums">
                  {formatPrice(s.price)}
                  {unit}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
