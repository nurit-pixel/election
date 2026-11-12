/**
 * חישוב סל בסניף אחד ודירוג סניפים. פונקציות טהורות, בלי מסד, כדי שיהיה קל לבדוק.
 *
 * כללים:
 * - פריט ברשימה הוא מוצר אחד או קבוצת חלופות; בכל סניף נלקחת החלופה הזולה (אחרי מבצעים).
 * - מוצר שקיל (bIsWeighted=1): הכמות בק"ג והמחיר לק"ג.
 * - מבצעים: ראו promos.ts. מבצע מועדון חל רק אם המועדון סומן בהגדרות; אחרת הוא מוצג
 *   כחיסכון אפשרי לחברי מועדון. מבצע עם סכום קנייה מינימלי לא מחושב, רק מוצג כהערה.
 * - סניף עם פריטים חסרים מסומן "נמצאו X מתוך Y" ואינו מדורג מעל סניף עם סל מלא.
 * - רשתות פארם אינן נכנסות לדירוג.
 */
import { classify, isActive, isComputable, isOpenTo, promoCost, type Promo } from "./promos";

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
  /** המבצעים של המוצר בסניף */
  promos?: Promo[];
};

export type AppliedPromo = { id: number; description: string; clubName: string | null };

export type FoundLine = {
  found: true;
  productId: number;
  productName: string;
  unitPrice: number;
  /** מחיר לפני מבצעים */
  regularTotal: number;
  /** מחיר לתשלום, אחרי המבצע שחל (אם חל) */
  total: number;
  promo: AppliedPromo | null;
  /** מבצע מועדון שלא סומן בהגדרות: כמה אפשר היה לחסוך כחבר מועדון */
  clubOffer: (AppliedPromo & { saving: number }) | null;
  /** מבצעים שלא חושבו (סכום קנייה מינימלי, הגבלת ימים/שעות) */
  notes: string[];
  fileTime: string;
  stale: boolean;
};

export type BasketLine = {
  itemId: number;
  itemName: string;
  quantity: number;
  isWeighted: boolean;
} & (FoundLine | { found: false });

export type StoreBasket = {
  lines: BasketLine[];
  total: number;
  /** סכום הסל לפני מבצעים */
  regularTotal: number;
  /** חיסכון ממבצעים שחושבו */
  savings: number;
  /** חיסכון אפשרי נוסף לחברי מועדון */
  clubSavings: number;
  foundCount: number;
  itemCount: number;
  complete: boolean;
  /** לפחות מחיר אחד בסל ישן מסף ההתיישנות */
  stale: boolean;
};

export type BasketOptions = {
  staleHours?: number;
  /** מזהי המועדונים של הרשת שהמשתמש סימן בהגדרות */
  memberClubIds?: Iterable<number>;
};

export const DEFAULT_STALE_HOURS = 36;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isStale(fileTime: string, now: Date, staleHours = DEFAULT_STALE_HOURS): boolean {
  return now.getTime() - new Date(fileTime).getTime() > staleHours * 3_600_000;
}

type Quote = { cost: number; promo: Promo | null };

/** העלות הזולה ביותר של מוצר בכמות נתונה, מבין המבצעים שעומדים בתנאי */
function bestQuote(price: StorePrice, item: BasketItem, allowed: (promo: Promo) => boolean): Quote {
  let best: Quote = { cost: price.price * item.quantity, promo: null };
  for (const promo of price.promos ?? []) {
    if (!allowed(promo)) continue;
    const cost = promoCost(price.price, item.quantity, item.isWeighted, promo);
    if (cost != null && cost < best.cost) best = { cost, promo };
  }
  return best;
}

const applied = (promo: Promo): AppliedPromo => ({
  id: promo.id,
  description: promo.description,
  clubName: promo.clubIds.length > 0 ? promo.clubName : null,
});

/** מחיר הסל בסניף אחד. prices: המחירים (והמבצעים) של הסניף לפי מזהה מוצר. */
export function priceBasket(
  items: BasketItem[],
  prices: Map<number, StorePrice>,
  now: Date,
  options: BasketOptions = {},
): StoreBasket {
  const staleHours = options.staleHours ?? DEFAULT_STALE_HOURS;
  const member = new Set(options.memberClubIds ?? []);
  const usable = (promo: Promo) => isActive(promo, now) && isComputable(promo);
  const open = (promo: Promo) => usable(promo) && isOpenTo(promo, member);

  const lines: BasketLine[] = items.map((item) => {
    const base = { itemId: item.id, itemName: item.name, quantity: item.quantity, isWeighted: item.isWeighted };
    let chosen: { price: StorePrice; quote: Quote } | undefined;
    let clubBest: Quote | undefined;
    for (const productId of item.productIds) {
      const price = prices.get(productId);
      if (!price) continue;
      const quote = bestQuote(price, item, open);
      if (!chosen || quote.cost < chosen.quote.cost) chosen = { price, quote };
      const withClubs = bestQuote(price, item, usable);
      if (!clubBest || withClubs.cost < clubBest.cost) clubBest = withClubs;
    }
    if (!chosen) return { ...base, found: false };

    const { price, quote } = chosen;
    const total = roundMoney(quote.cost);
    const clubSaving = clubBest ? roundMoney(total - roundMoney(clubBest.cost)) : 0;
    const notes = (price.promos ?? [])
      .filter((p) => isActive(p, now) && !isComputable(p))
      .map((p) =>
        p.minPurchase != null && p.minPurchase > 0
          ? `${p.description} (בקנייה מעל ₪${p.minPurchase})`
          : p.description,
      );
    return {
      ...base,
      found: true,
      productId: price.productId,
      productName: price.productName,
      unitPrice: price.price,
      regularTotal: roundMoney(price.price * item.quantity),
      total,
      promo: quote.promo ? applied(quote.promo) : null,
      clubOffer:
        clubBest?.promo && clubSaving > 0 && clubBest.promo.clubIds.length > 0
          ? { ...applied(clubBest.promo), saving: clubSaving }
          : null,
      notes: [...new Set(notes)],
      fileTime: price.fileTime,
      stale: isStale(price.fileTime, now, staleHours),
    };
  });

  poolBundles(lines, prices, open);

  const found = lines.filter((l): l is BasketLine & FoundLine => l.found);
  const total = roundMoney(found.reduce((sum, l) => sum + l.total, 0));
  const regularTotal = roundMoney(found.reduce((sum, l) => sum + l.regularTotal, 0));
  return {
    lines,
    total,
    regularTotal,
    savings: roundMoney(regularTotal - total),
    clubSavings: roundMoney(found.reduce((sum, l) => sum + (l.clubOffer?.saving ?? 0), 0)),
    foundCount: found.length,
    itemCount: items.length,
    complete: items.length > 0 && found.length === items.length,
    stale: found.some((l) => l.stale),
  };
}

/**
 * מבצע "N ב-X" שחל על כמה מוצרים שונים (למשל 4 יוגורטים ב-20, מכל הטעמים): הכמויות של
 * כמה שורות בסל מצטרפות יחד. חישוב שמרני: לחבילות נכנסות היחידות הזולות, והיתר במחיר מלא.
 * מוחל רק אם הוא מוזיל את השורות המשתתפות לעומת החישוב לכל שורה בנפרד.
 */
function poolBundles(lines: BasketLine[], prices: Map<number, StorePrice>, open: (promo: Promo) => boolean): void {
  const groups = new Map<number, { promo: Promo; lines: (BasketLine & FoundLine)[] }>();
  for (const line of lines) {
    if (!line.found || line.isWeighted || !Number.isInteger(line.quantity)) continue;
    for (const promo of prices.get(line.productId)?.promos ?? []) {
      if (!open(promo) || classify(promo, line.unitPrice, false)?.kind !== "bundle") continue;
      if (!groups.has(promo.id)) groups.set(promo.id, { promo, lines: [] });
      groups.get(promo.id)!.lines.push(line);
    }
  }
  const pooled = new Set<number>();
  for (const { promo, lines: members } of groups.values()) {
    if (members.length < 2 || members.some((l) => pooled.has(l.itemId))) continue;
    const n = promo.minQty;
    const units = members
      .flatMap((l) => Array.from({ length: l.quantity }, () => ({ line: l, price: l.unitPrice })))
      .sort((a, b) => a.price - b.price);
    const eligible = promo.maxQty != null && promo.maxQty > 0 ? Math.min(units.length, promo.maxQty) : units.length;
    const bundled = Math.floor(eligible / n) * n;
    if (bundled === 0) continue;
    const bundleCost = (bundled / n) * promo.discountedPrice!;
    const bundledValue = units.slice(0, bundled).reduce((sum, u) => sum + u.price, 0);
    const pooledCost = bundleCost + units.slice(bundled).reduce((sum, u) => sum + u.price, 0);
    const currentCost = members.reduce((sum, l) => sum + l.total, 0);
    if (pooledCost >= currentCost - 0.005) continue;

    // חלוקת מחיר החבילות בין השורות לפי שווי היחידות של כל שורה בחבילות
    let assigned = 0;
    members.forEach((line, index) => {
      const mine = units.map((u, i) => ({ u, i })).filter(({ u }) => u.line === line);
      const inBundle = mine.filter(({ i }) => i < bundled).reduce((sum, { u }) => sum + u.price, 0);
      const outside = mine.filter(({ i }) => i >= bundled).reduce((sum, { u }) => sum + u.price, 0);
      const share =
        index === members.length - 1
          ? roundMoney(pooledCost - assigned)
          : roundMoney(outside + (bundledValue > 0 ? (bundleCost * inBundle) / bundledValue : 0));
      assigned += share;
      line.total = share;
      line.promo = { id: promo.id, description: promo.description, clubName: promo.clubIds.length > 0 ? promo.clubName : null };
      pooled.add(line.itemId);
    });
  }
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
