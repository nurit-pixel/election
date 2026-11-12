import Link from "next/link";
import { getList, type ListItem } from "@/lib/lists";
import { SearchBar } from "@/components/SearchBar";
import { QuantityControl } from "@/components/QuantityControl";
import { removeAlternative, removeItem, renameItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  const list = await getList();
  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-lg font-bold">{list.name}</h1>
      <SearchBar />

      {list.items.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-slate-600">
          הרשימה ריקה. חפשו מוצר לפי שם או סרקו ברקוד כדי להוסיף.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </ul>
      )}

      {list.items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <Link
            href="/compare"
            className="mx-auto block max-w-2xl rounded-xl bg-emerald-600 px-5 py-3 text-center font-semibold text-white"
          >
            השוואת סניפים ({list.items.length} פריטים)
          </Link>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: ListItem }) {
  const many = item.products.length > 1;
  return (
    <li id={`item-${item.id}`} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{item.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {many ? `${item.products.length} חלופות – בכל סניף תיבחר הזולה` : "מוצר אחד"}
            {item.isWeighted && " · מוצר שקיל, כמות בק״ג"}
          </p>
        </div>
        <form action={removeItem}>
          <input type="hidden" name="item" value={item.id} />
          <button className="text-sm text-rose-600" aria-label={`הסרת ${item.name}`}>
            הסרה
          </button>
        </form>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <QuantityControl itemId={item.id} quantity={item.quantity} isWeighted={item.isWeighted} />
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none text-emerald-700">חלופות ושם הפריט</summary>
        <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
          {item.products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate">{p.name}</div>
                <div className="text-xs text-slate-400">
                  {p.manufacturer && `${p.manufacturer} · `}
                  <span dir="ltr">{p.barcode}</span>
                  {p.chainName && ` · רק ב${p.chainName}`}
                </div>
              </div>
              <form action={removeAlternative}>
                <input type="hidden" name="item" value={item.id} />
                <input type="hidden" name="product" value={p.id} />
                <button className="shrink-0 text-xs text-rose-600">הסרה</button>
              </form>
            </li>
          ))}
        </ul>
        <Link
          href={`/search?item=${item.id}&q=${encodeURIComponent(item.name)}`}
          className="mt-2 inline-block rounded-lg border border-emerald-600 px-3 py-1.5 font-medium text-emerald-700"
        >
          הוספת חלופה
        </Link>
        <form action={renameItem} className="mt-3 flex gap-2">
          <input type="hidden" name="item" value={item.id} />
          <input
            name="name"
            defaultValue={item.name}
            aria-label="שם הפריט ברשימה"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5"
          />
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">שינוי שם</button>
        </form>
      </details>
    </li>
  );
}
