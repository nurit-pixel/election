/** חישוב מדד הסל מתוך המחיר הזול ליום לכל פריט. לוגיקה טהורה. */

export type BasketPoint = { day: string; price: number };
export type ItemDayPrice = { day: string; itemId: number; price: number };

/** מחיר שלא התעדכן נשאר בתוקף עד שבוע, כדי שיום בלי קובץ מרשת לא יעלים פריט מהגרף */
const CARRY_DAYS = 7;

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;

/** הסל לכל יום: סכום המחיר האחרון הידוע (עד שבוע אחורה) של כל פריט, כפול הכמות. נספרים רק פריטים שיש להם
 * מחיר ביום האחרון; יום שחסר בו אחד מהם לא מוצג. */
export function basketSeries(
  rows: ItemDayPrice[],
  quantities: Map<number, number>,
): { points: BasketPoint[]; itemsCounted: number } {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  if (days.length === 0) return { points: [], itemsCounted: 0 };
  const byItem = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!byItem.has(r.itemId)) byItem.set(r.itemId, new Map());
    byItem.get(r.itemId)!.set(r.day, r.price);
  }
  const lastDay = days[days.length - 1];
  const priceOn = (prices: Map<string, number>, day: string): number | null => {
    const target = dayNumber(day);
    let best: { at: number; price: number } | null = null;
    for (const [d, price] of prices) {
      const at = dayNumber(d);
      if (at <= target && target - at < CARRY_DAYS && (!best || at > best.at)) best = { at, price };
    }
    return best ? best.price : null;
  };
  const counted = [...byItem.entries()].filter(([, prices]) => priceOn(prices, lastDay) != null);
  const points: BasketPoint[] = [];
  for (const day of days) {
    let total = 0;
    let complete = true;
    for (const [itemId, prices] of counted) {
      const price = priceOn(prices, day);
      if (price == null) {
        complete = false;
        break;
      }
      total += price * (quantities.get(itemId) ?? 1);
    }
    if (complete && counted.length > 0) points.push({ day, price: Math.round(total * 100) / 100 });
  }
  return { points, itemsCounted: counted.length };
}
