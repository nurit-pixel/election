/** "פראיירמטר" לחשבונית: כמה שילמת לעומת סניף זול באזור, על אותם מוצרים. לוגיקה טהורה. */

export type PaidItem = { productId: number; /** מחיר ליחידה ששולם, לפי החשבונית */ paid: number };
export type StoreOffer = { storePk: number; label: string; prices: Map<number, number> };

export type Overpay = {
  /** כמה מוצרים מהחשבונית נכנסו להשוואה (יש להם מחיר ששולם ומחיר בסניף שנבחר) */
  count: number;
  paid: number;
  /** הסכום על אותם מוצרים בסניף שנבחר */
  elsewhere: number;
  /** חיובי: שילמת יותר. שלילי: שילמת פחות */
  difference: number;
  store: { storePk: number; label: string };
};

const round = (n: number) => Math.round(n * 100) / 100;

/** הסניף שמוכר הכי הרבה מהמוצרים, ובשוויון הזול מביניהם; ההשוואה רק על המוצרים שיש לו.
 * null כשאין לפחות שני מוצרים להשוואה. */
export function overpay(items: PaidItem[], stores: StoreOffer[]): Overpay | null {
  const paid = new Map<number, number>();
  for (const item of items) {
    if (Number.isFinite(item.paid) && item.paid > 0 && !paid.has(item.productId)) paid.set(item.productId, item.paid);
  }
  let best: { store: StoreOffer; count: number; paid: number; elsewhere: number } | null = null;
  for (const store of stores) {
    let count = 0;
    let paidSum = 0;
    let elsewhere = 0;
    for (const [productId, amount] of paid) {
      const price = store.prices.get(productId);
      if (price == null) continue;
      count += 1;
      paidSum += amount;
      elsewhere += price;
    }
    if (count === 0) continue;
    if (!best || count > best.count || (count === best.count && elsewhere - paidSum < best.elsewhere - best.paid)) {
      best = { store, count, paid: paidSum, elsewhere };
    }
  }
  if (!best || best.count < 2) return null;
  return {
    count: best.count,
    paid: round(best.paid),
    elsewhere: round(best.elsewhere),
    difference: round(best.paid - best.elsewhere),
    store: { storePk: best.store.storePk, label: best.store.label },
  };
}
