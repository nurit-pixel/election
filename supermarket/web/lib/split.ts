/**
 * פיצול הסל לשני סניפים. פונקציות טהורות.
 *
 * כללים:
 * - נבדקים כל הזוגות מבין עד 20 הסניפים הקרובים.
 * - כל פריט הולך לסניף שבו הוא זול יותר (אחרי מבצעים); פריט שקיים רק באחד הולך אליו.
 * - אחרי החלוקה כל חצי-סל מחושב מחדש, כי מבצע שתלוי בכמות (או בצירוף כמה פריטים)
 *   עלול להשתנות כשחלק מהפריטים עוברים לסניף השני.
 * - פיצול מוצג רק אם הוא חוסך יותר מהסף לעומת הסל הזול ביותר בסניף אחד.
 */
import { priceBasket, roundMoney, type BasketItem, type BasketOptions, type StoreBasket, type StorePrice } from "./basket";

export const MAX_SPLIT_STORES = 20;
export const DEFAULT_SPLIT_MIN_SAVING = 20;

export type SplitCandidate<T> = {
  store: T;
  /** מרחק מהכתובת השמורה הקרובה; null = לא ידוע (ממוין אחרון) */
  distanceKm: number | null;
  prices: Map<number, StorePrice>;
  memberClubIds?: Iterable<number>;
};

export type SplitPair<T> = {
  a: T;
  b: T;
  basketA: StoreBasket;
  basketB: StoreBasket;
  total: number;
  foundCount: number;
  itemCount: number;
  complete: boolean;
  /** פריטים שלא נמצאו באף אחד משני הסניפים */
  missing: BasketItem[];
};

export type SingleStoreBaseline = { total: number; foundCount: number };

/** עד 20 הסניפים הקרובים ביותר */
export function nearestStores<T>(stores: SplitCandidate<T>[], limit = MAX_SPLIT_STORES): SplitCandidate<T>[] {
  return [...stores]
    .sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity))
    .slice(0, limit);
}

/** פיצול הסל בין שני סניפים נתונים. null אם כל הפריטים יוצאים באותו סניף. */
export function splitBetween<T>(
  items: BasketItem[],
  a: SplitCandidate<T>,
  b: SplitCandidate<T>,
  now: Date,
  options: Pick<BasketOptions, "staleHours"> = {},
): SplitPair<T> | null {
  const optionsA = { ...options, memberClubIds: a.memberClubIds };
  const optionsB = { ...options, memberClubIds: b.memberClubIds };
  const fullA = priceBasket(items, a.prices, now, optionsA);
  const fullB = priceBasket(items, b.prices, now, optionsB);

  const itemsA: BasketItem[] = [];
  const itemsB: BasketItem[] = [];
  const missing: BasketItem[] = [];
  items.forEach((item, index) => {
    const lineA = fullA.lines[index];
    const lineB = fullB.lines[index];
    if (lineA.found && (!lineB.found || lineA.total <= lineB.total)) itemsA.push(item);
    else if (lineB.found) itemsB.push(item);
    else missing.push(item);
  });
  if (itemsA.length === 0 || itemsB.length === 0) return null;

  const basketA = priceBasket(itemsA, a.prices, now, optionsA);
  const basketB = priceBasket(itemsB, b.prices, now, optionsB);
  return {
    a: a.store,
    b: b.store,
    basketA,
    basketB,
    total: roundMoney(basketA.total + basketB.total),
    foundCount: itemsA.length + itemsB.length,
    itemCount: items.length,
    complete: missing.length === 0,
    missing,
  };
}

/** כל הזוגות מבין הסניפים הקרובים, מהזול ליקר (זוגות עם יותר פריטים קודם). */
export function allSplits<T>(
  items: BasketItem[],
  stores: SplitCandidate<T>[],
  now: Date,
  options: Pick<BasketOptions, "staleHours"> = {},
): SplitPair<T>[] {
  const nearest = nearestStores(stores);
  const pairs: SplitPair<T>[] = [];
  for (let i = 0; i < nearest.length; i++) {
    for (let j = i + 1; j < nearest.length; j++) {
      const pair = splitBetween(items, nearest[i], nearest[j], now, options);
      if (pair) pairs.push(pair);
    }
  }
  return pairs.sort((x, y) => y.foundCount - x.foundCount || x.total - y.total);
}

export type SplitOffer<T> = SplitPair<T> & {
  /** חיסכון לעומת הסל הזול בסניף אחד; null כשהפיצול משלים פריטים שאין באף סניף יחיד */
  saving: number | null;
};

/**
 * הפיצולים שכדאי להציג:
 * - כשיש סניף אחד עם כל הסל: זוגות מלאים שחוסכים לפחות minSaving לעומתו.
 * - כשאין: זוגות שנמצאו בהם יותר פריטים מאשר בכל סניף יחיד (בלי תנאי חיסכון).
 */
export function worthwhileSplits<T>(
  pairs: SplitPair<T>[],
  baseline: SingleStoreBaseline | null,
  minSaving = DEFAULT_SPLIT_MIN_SAVING,
  limit = 5,
): SplitOffer<T>[] {
  const offers: SplitOffer<T>[] = [];
  for (const pair of pairs) {
    if (!baseline || pair.foundCount > baseline.foundCount) {
      offers.push({ ...pair, saving: null });
    } else if (pair.foundCount === baseline.foundCount) {
      const saving = roundMoney(baseline.total - pair.total);
      if (saving >= minSaving) offers.push({ ...pair, saving });
    }
  }
  return offers.slice(0, limit);
}
