/**
 * חישוב מבצעים לשורה אחת בסל. פונקציות טהורות.
 *
 * סוגי ההטבה:
 *  - מחיר מוזל: מחיר חדש ליחידה (או לק"ג), לעיתים רק מכמות מינימלית.
 *  - כמות במחיר קבוע: "N ב-X".
 *  - הנחה על הפריט ה-N: "1+1", "השני ב-50%".
 *
 * בקבצים שהרשתות מפרסמות בפועל מספרי ה-RewardType אינם אחידים בין הרשתות (למשל "2 ב-12"
 * מופיע כ-1 או כ-10, ומחיר מוזל כ-3 או כ-2), ולכן הסוג נקבע לפי השדות עצמם:
 * MinQty, DiscountedPrice, ומחיר המדף.
 */

export type Promo = {
  id: number;
  description: string;
  startAt: string | null;
  endAt: string | null;
  /** כמות מינימלית להפעלת המבצע (יחידות או ק"ג) */
  minQty: number;
  /** כמות מרבית שעליה חל המבצע */
  maxQty: number | null;
  discountedPrice: number | null;
  /** הנחה על הפריט ה-N: כל פריט N-י בהנחה של nthRate אחוזים */
  nthN: number | null;
  nthRate: number | null;
  /** ריק = כלל הלקוחות (ClubId 0) */
  clubIds: number[];
  clubName: string | null;
  /** MinPurchaseAmnt: מבצע כזה לא מחושב, רק מוצג כהערה */
  minPurchase: number | null;
  /** מוגבל לימים/שעות או מבנה שאינו ניתן לחישוב – מוצג כהערה בלבד */
  restricted: boolean;
};

export type PromoKind =
  | { kind: "unit_price"; price: number; minQty: number }
  | { kind: "bundle"; n: number; price: number }
  | { kind: "nth"; n: number; rate: number };

export function isActive(promo: Promo, now: Date): boolean {
  if (promo.startAt && new Date(promo.startAt).getTime() > now.getTime()) return false;
  if (promo.endAt && new Date(promo.endAt).getTime() < now.getTime()) return false;
  return true;
}

/** מבצע שאפשר לחשב: בלי סכום קנייה מינימלי ובלי הגבלות נוספות */
export function isComputable(promo: Promo): boolean {
  return !promo.restricted && !(promo.minPurchase != null && promo.minPurchase > 0);
}

/** האם המבצע פתוח ללקוח: לכלל הלקוחות, או למועדון שהמשתמש סימן בהגדרות */
export function isOpenTo(promo: Promo, memberClubIds: ReadonlySet<number>): boolean {
  return promo.clubIds.length === 0 || promo.clubIds.some((id) => memberClubIds.has(id));
}

export function classify(promo: Promo, unitPrice: number, isWeighted: boolean): PromoKind | null {
  const price = promo.discountedPrice;
  const minQty = promo.minQty > 0 ? promo.minQty : 1;
  if (price != null && price > 0) {
    // "N ב-X": המחיר המוזל הוא לכל הכמות, ולכן גבוה ממחיר יחידה אחת
    if (!isWeighted && Number.isInteger(minQty) && minQty >= 2 && price > unitPrice) {
      return price < minQty * unitPrice ? { kind: "bundle", n: minQty, price } : null;
    }
    if (price < unitPrice) return { kind: "unit_price", price, minQty };
  }
  if (!isWeighted && promo.nthN != null && promo.nthN >= 2 && promo.nthRate != null && promo.nthRate > 0) {
    return { kind: "nth", n: promo.nthN, rate: Math.min(promo.nthRate, 100) };
  }
  return null;
}

/**
 * עלות השורה עם המבצע, או null אם המבצע אינו חל על הכמות הזו או אינו מוזיל.
 * quantity ביחידות, או בק"ג למוצר שקיל (unitPrice הוא אז מחיר לק"ג).
 */
export function promoCost(unitPrice: number, quantity: number, isWeighted: boolean, promo: Promo): number | null {
  const kind = classify(promo, unitPrice, isWeighted);
  if (!kind) return null;
  const regular = unitPrice * quantity;
  const eligible = promo.maxQty != null && promo.maxQty > 0 ? Math.min(quantity, promo.maxQty) : quantity;
  let cost: number;
  if (kind.kind === "unit_price") {
    if (quantity < kind.minQty) return null;
    cost = eligible * kind.price + (quantity - eligible) * unitPrice;
  } else if (kind.kind === "bundle") {
    const bundles = Math.floor(eligible / kind.n);
    if (bundles === 0) return null;
    cost = bundles * kind.price + (quantity - bundles * kind.n) * unitPrice;
  } else {
    const discounted = Math.floor(eligible / kind.n);
    if (discounted === 0) return null;
    cost = regular - discounted * unitPrice * (kind.rate / 100);
  }
  return cost < regular - 1e-9 ? cost : null;
}
