/**
 * חישוב סל בסניף אחד ודירוג סניפים. פונקציות טהורות, בלי מסד, כדי שיהיה קל לבדוק.
 *
 * כללים:
 * - פריט ברשימה הוא מוצר אחד או קבוצת חלופות; בכל סניף נלקחת החלופה הזולה.
 * - מוצר שקיל (bIsWeighted=1): הכמות בק"ג והמחיר לק"ג.
 * - סניף עם פריטים חסרים מסומן "נמצאו X מתוך Y" ואינו מדורג מעל סניף עם סל מלא.
 * - רשתות פארם אינן נכנסות לדירוג.
 */

export type BasketItem = {
  id: number;
  name: string;
  /** יחידות, או ק"ג למוצר שקיל */
  quantity: number;
  isWeighted: boolean;
  /** החלופות שהמשתמש הגדיר לפריט */
  productIds: number[];
};

export type StorePrice = {
  productId: number;
  productName: string;
  /** מחיר ליחידה, או לק"ג למוצר שקיל */
  price: number;
  /** חותמת הזמן של קובץ המחירים */
  fileTime: string;
};

export type BasketLine = {
  itemId: number;
  itemName: string;
  quantity: number;
  isWeighted: boolean;
} & (
  | { found: true; productId: number; productName: string; unitPrice: number; total: number; fileTime: string; stale: boolean }
  | { found: false }
);

export type StoreBasket = {
  lines: BasketLine[];
  total: number;
  foundCount: number;
  itemCount: number;
  complete: boolean;
  /** לפחות מחיר אחד בסל ישן מסף ההתיישנות */
  stale: boolean;
};

export const DEFAULT_STALE_HOURS = 36;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isStale(fileTime: string, now: Date, staleHours = DEFAULT_STALE_HOURS): boolean {
  return now.getTime() - new Date(fileTime).getTime() > staleHours * 3_600_000;
}

/** מחיר הסל בסניף אחד. prices: המחירים של הסניף לפי מזהה מוצר. */
export function priceBasket(
  items: BasketItem[],
  prices: Map<number, StorePrice>,
  now: Date,
  staleHours = DEFAULT_STALE_HOURS,
): StoreBasket {
  const lines: BasketLine[] = items.map((item) => {
    const base = { itemId: item.id, itemName: item.name, quantity: item.quantity, isWeighted: item.isWeighted };
    let best: StorePrice | undefined;
    for (const productId of item.productIds) {
      const candidate = prices.get(productId);
      if (candidate && (!best || candidate.price < best.price)) best = candidate;
    }
    if (!best) return { ...base, found: false };
    return {
      ...base,
      found: true,
      productId: best.productId,
      productName: best.productName,
      unitPrice: best.price,
      total: roundMoney(best.price * item.quantity),
      fileTime: best.fileTime,
      stale: isStale(best.fileTime, now, staleHours),
    };
  });
  const found = lines.filter((l) => l.found);
  return {
    lines,
    total: roundMoney(found.reduce((sum, l) => sum + (l.found ? l.total : 0), 0)),
    foundCount: found.length,
    itemCount: items.length,
    complete: items.length > 0 && found.length === items.length,
    stale: found.some((l) => l.found && l.stale),
  };
}

export type RankableStore = { isPharm: boolean; basket: StoreBasket };

/**
 * דירוג סניפים: קודם סלים מלאים מהזול ליקר; אחריהם סלים חלקיים, לפי מספר הפריטים
 * שנמצאו (יותר קודם) ואז לפי מחיר. סניפי פארם וסניפים בלי אף פריט אינם מדורגים.
 */
export function rankStores<T extends RankableStore>(stores: T[]): T[] {
  return stores
    .filter((s) => !s.isPharm && s.basket.foundCount > 0)
    .sort((a, b) => {
      if (a.basket.complete !== b.basket.complete) return a.basket.complete ? -1 : 1;
      if (a.basket.foundCount !== b.basket.foundCount) return b.basket.foundCount - a.basket.foundCount;
      return a.basket.total - b.basket.total;
    });
}
