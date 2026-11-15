import Link from "next/link";
import { getList, listPeople } from "@/lib/lists";
import { compareStores, storeBasket } from "@/lib/compare";
import { OnlineOrder } from "@/components/OnlineOrder";
import { pageId } from "@/lib/ids";
import { ShoppingList, type ShopItem } from "@/components/ShoppingList";
import { Price } from "@/components/ui";
import { finishShopping } from "./actions";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const list = await getList();
  const people = await listPeople(list.id);
  const { ranked } = await compareStores();
  const top = ranked.filter((s) => s.basket.complete).slice(0, 5);
  // הסניף שבו קונים: לפי בחירה, אחרת הזול עם סל מלא
  const chosenId = pageId((await searchParams).store ?? "") ?? top[0]?.storePk ?? null;
  const store = chosenId != null ? await storeBasket(chosenId) : null;
  const priceOf = new Map(store?.basket.lines.flatMap((l) => (l.found ? [[l.itemId, l.total] as const] : [])) ?? []);
  // מותג שלא נמכר בסניף: איזה מוצר דומה נבחר במקומו
  const substituteOf = new Map(
    store?.basket.lines.flatMap((l) => (l.found && l.substitute ? [[l.itemId, l.productName] as const] : [])) ?? [],
  );

  const items: ShopItem[] = list.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    isWeighted: item.isWeighted,
    checked: item.checked,
    price: priceOf.get(item.id) ?? null,
    substitute: substituteOf.get(item.id) ?? null,
  }));
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-link">
          חזרה לרשימה
        </Link>
        <h1 className="mt-1">מצב קנייה</h1>
        <p className="mt-1 text-sm text-muted">
          {list.name} · לוחצים על פריט כשהוא נכנס לעגלה
          {people && people.members.length > 0 && " · מתעדכן גם אצל השותפים"}
        </p>
      </div>

      {top.length > 0 && (
        <form action="/shop" className="flex items-center gap-2 text-sm">
          <label htmlFor="shop-store" className="shrink-0 font-bold">
            קונים ב:
          </label>
          <select
            id="shop-store"
            name="store"
            defaultValue={store?.storePk}
            className="min-h-11 min-w-0 flex-1 rounded-[13px] border border-line bg-card px-3"
          >
            {store && !top.some((s) => s.storePk === store.storePk) && (
              <option value={store.storePk}>
                {store.chainName} · {store.name}
              </option>
            )}
            {top.map((s) => (
              <option key={s.storePk} value={s.storePk}>
                {s.chainName} · {s.name} – ₪{s.basket.total.toFixed(2)}
              </option>
            ))}
          </select>
          <button className="min-h-11 shrink-0 rounded-[13px] bg-subtle px-3 font-bold">הצגה</button>
        </form>
      )}
      {store && (
        <p className="text-sm text-muted">
          המחירים לפי {store.chainName} · {store.name}. סך הכול לסל: <Price value={store.basket.total} className="font-bold text-ink" />
        </p>
      )}
      {store && <OnlineOrder store={store} />}

      {items.length === 0 ? (
        <p className="rounded-pm-lg border border-line bg-card p-4 text-muted">הרשימה ריקה. אין מה לקנות, ואין על מה לצאת פראייר.</p>
      ) : (
        <ShoppingList items={items} shared={Boolean(people && people.members.length > 0)} />
      )}

      {checkedCount > 0 && (
        <form action={finishShopping} className="pt-2">
          <input type="hidden" name="list" value={list.id} />
          <button className="min-h-[52px] w-full rounded-pm bg-primary pm-cta px-5 text-on-primary">
            סיימתי לקנות (ניקוי הסימונים)
          </button>
          <p className="mt-1 text-center text-xs text-muted">הפריטים נשארים ברשימה לפעם הבאה; רק הסימונים מתאפסים.</p>
        </form>
      )}
    </div>
  );
}
