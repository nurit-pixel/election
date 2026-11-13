import { Quip } from "@/components/Quip";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageId } from "@/lib/ids";
import { revalidatePath } from "next/cache";
import { getProduct, trackProduct, untrackProduct } from "@/lib/tracking";
import { formatPrice, formatUpdated } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import { addProduct } from "@/app/actions";

export const dynamic = "force-dynamic";

async function track(formData: FormData) {
  "use server";
  const id = Number(formData.get("product"));
  const raw = String(formData.get("target") ?? "").trim();
  const target = raw === "" ? null : Number(raw);
  if (target != null && !(Number.isFinite(target) && target > 0)) return;
  await trackProduct(id, target);
  revalidatePath(`/product/${id}`);
}

async function untrack(formData: FormData) {
  "use server";
  const id = Number(formData.get("product"));
  await untrackProduct(id);
  revalidatePath(`/product/${id}`);
}

const dayLabel = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = pageId((await params).id);
  const product = id == null ? null : await getProduct(id);
  if (!product) notFound();
  const unit = product.isWeighted ? " לק״ג" : "";
  const cheapest = product.prices[0];
  const days = product.history.map((h) => h.day);

  return (
    <div className="space-y-4">
      <div className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <h1 className="pm-h1-compact text-xl font-extrabold leading-snug">{product.name}</h1>
        <p className="mt-0.5 text-xs text-muted">
          {product.manufacturer && `${product.manufacturer} · `}
          <span dir="ltr">{product.barcode}</span>
          {product.chainName && ` · רק ב${product.chainName}`}
          {product.isWeighted && " · מוצר שקיל"}
        </p>
        {cheapest ? (
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="text-sm text-muted">
              הזול ביותר: {cheapest.chainName} · {cheapest.storeName}
            </div>
            <div className="shrink-0 text-2xl font-bold tabular-nums text-link">
              {formatPrice(cheapest.price)}
              <span className="text-sm font-normal text-muted">{unit}</span>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">אין מחיר עדכני בסניפים שברדיוס.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={addProduct}>
            <input type="hidden" name="product" value={product.id} />
            <button className="rounded-pm bg-primary px-4 py-2 text-sm font-semibold text-on-primary">הוספה לרשימה</button>
          </form>
        </div>
        {product.inLists.length > 0 && (
          <p className="mt-2 text-xs text-muted">נמצא ברשימות: {product.inLists.join(", ")}</p>
        )}
      </div>

      <section className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <h2 className="font-semibold">מעקב מחיר</h2>
        <Quip place="product" className="my-3" />
        <p className="mt-0.5 text-xs text-muted">
          התראה תישלח כשהמחיר משתנה ב-10% ומעלה, או כשהוא יורד אל מחיר היעד.
        </p>
        <form action={track} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="product" value={product.id} />
          <label htmlFor="target" className="text-muted">
            מחיר יעד (₪, לא חובה)
          </label>
          <input
            id="target"
            name="target"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            defaultValue={product.targetPrice ?? ""}
            className="w-24 rounded-lg border border-line px-2 py-1.5"
          />
          <button className="rounded-lg bg-primary px-3 py-1.5 font-medium text-on-primary">
            {product.tracked ? "עדכון" : "הוספה למעקב"}
          </button>
        </form>
        {product.tracked && (
          <form action={untrack} className="mt-2">
            <input type="hidden" name="product" value={product.id} />
            <button className="text-sm text-missing">הסרה מהמעקב</button>
          </form>
        )}
      </section>

      <section className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <h2 className="font-semibold">המחיר הזול ביותר לאורך זמן</h2>
        {product.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {product.tracked || product.inLists.length > 0
              ? "ההיסטוריה תתחיל להיאסף בטעינת המחירים הבאה."
              : "היסטוריית מחירים נשמרת רק למוצרים במעקב או ברשימה שמורה."}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">
              בסניפים שברדיוס, {product.history.length === 1 ? "יום אחד" : `${product.history.length} ימים`}
            </p>
            <div className="mt-2">
              <PriceChart points={product.history} target={product.targetPrice} unit={unit} />
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer select-none text-link">טבלה לפי רשת</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-1 pl-3 font-medium">רשת</th>
                      {days.map((day) => (
                        <th key={day} className="px-2 py-1 font-medium tabular-nums">
                          {dayLabel(day)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.historyByChain.map((chain) => (
                      <tr key={chain.chainName} className="border-b border-subtle">
                        <td className="py-1 pl-3">{chain.chainName}</td>
                        {days.map((day) => {
                          const point = chain.points.find((p) => p.day === day);
                          return (
                            <td key={day} className="px-2 py-1 tabular-nums">
                              {point ? point.price.toFixed(2) : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      {product.prices.length > 0 && (
        <section className="rounded-pm-lg border border-line bg-card shadow-card">
          <h2 className="p-4 pb-2 font-semibold">מחירים עכשיו ({product.prices.length} סניפים)</h2>
          <ul className="divide-y divide-subtle text-sm">
            {product.prices.slice(0, 30).map((s) => (
              <li key={s.storePk} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <Link href={`/store/${s.storePk}`} className="block truncate">
                    {s.chainName} · {s.storeName}
                  </Link>
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
          {product.prices.length > 30 && (
            <p className="p-4 pt-2 text-xs text-muted">מוצגים 30 הסניפים הזולים.</p>
          )}
        </section>
      )}
    </div>
  );
}
