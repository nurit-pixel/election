/** הצעה לחלופה זולה למוצר ברשימה: מוצר דומה (אותה מילה ראשונה, אותו גודל ואחוז שומן) שזול לפחות ב-15%. לוגיקה טהורה. */

import { effectiveSize, packCount } from "./unit-price";

export type ProductOffer = {
  id: number;
  name: string;
  isWeighted: boolean;
  /** היצרן: מילים מהשם שמופיעות גם כאן הן שם המותג, ומותר שיהיו שונות בחלופה */
  manufacturer?: string | null;
  /** כמות באריזה (למשל 250) ויחידת המידה שלה (למשל "100 גרם"), כפי שהרשת מפרסמת */
  quantity: number | null;
  unit: string | null;
  /** המחיר הזול בסניפים שבאזור */
  minPrice: number;
};

export type Suggestion = { product: ProductOffer; saving: number; savingPct: number };

export const MIN_SAVING_PCT = 15;

const firstWord = (name: string) => name.trim().split(/\s+/)[0]?.replace(/["'״׳]/g, "") ?? "";
const percents = (name: string) => (name.match(/\d+(?:[.,]\d+)?\s*%/g) ?? []).map((p) => p.replace(/\s|,/g, "").replace(",", ".")).sort().join("|");

/** מילים שמבדילות בין גרסאות של אותו מוצר. אם אחת מהן מופיעה רק באחד השמות, אלה מוצרים שונים
 * (קולה מול קולה זירו, ביצים M מול ביצים L). */
const VARIANTS: RegExp[] = [
  /זירו|zero/i, /דיאט|diet/i, /לייט|light/i, /אומגה/, /אורגני/, /ללא סוכר|בלי סוכר/, /ללא גלוטן/, /ללא לקטוז|דל לקטוז/,
  /מופחת/, /דל שומן|דל נתרן/, /טבעוני/, /מלא|מלאה/, /שוקו|שוקולד/, /וניל/, /תות/, /בננה/, /לימון/, /מוגז/, /פרוס/,
  /מגורד/, /מעושן/, /חריף/, /(?:^|[\s\d])S(?=$|\s)/, /(?:^|[\s\d])M(?=$|\s)/, /(?:^|[\s\d])L(?=$|\s)/,
  /(?:^|[\s\d])XL(?=$|\s)/, /בינוני/, /גדול/, /קטן/, /ענק/, /(?:^|\s)עם\s/, /זיתים/, /נטול/, /אדמה/, /חמוץ|חמוצים|כבוש/, /שמיר/, /פלפל/,
];

/** מילות יחידה ומידה, שאינן חלק מזהות המוצר */
const UNIT_WORDS = new Set(["גרם", "גר", "ג", "מל", "מ", "ליטר", "ל", "קג", "ק", "יח", "יחידות", "יחידה", "מארז", "שישייה", "אריזה", "שומן"]);

/** המילים בעברית בשם, בלי מספרים ומילות מידה ("זירו330מל" נותן "זירו") */
export function nameWords(name: string): Set<string> {
  return new Set(
    name
      .replace(/["'״׳*.,()/%+&-]/g, " ")
      .replace(/\d+/g, " ")
      .split(/\s+/)
      .filter((w) => /^[א-ת]{2,}$/.test(w) && !UNIT_WORDS.has(w)),
  );
}

/** המילים שמגדירות את המוצר: כל מילות השם, מלבד שם המותג (מילים שמופיעות בשם היצרן) */
export function definingWords(offer: Pick<ProductOffer, "name" | "manufacturer">): string[] {
  const brand = nameWords(offer.manufacturer ?? "");
  return [...nameWords(offer.name)].filter((w) => !brand.has(w));
}

/** הגודל בפועל של ההצעה, בגרם / מ״ל / יחידות */
const sizeOf = (offer: ProductOffer) => effectiveSize(offer.quantity, offer.unit, offer.name);

/** מחיר להשוואה: לאריזה בגודל של המוצר המקורי, כשהגדלים ידועים; אחרת המחיר כמו שהוא */
function comparablePrice(offer: ProductOffer, reference: ProductOffer): number {
  const size = sizeOf(offer);
  const refSize = sizeOf(reference);
  if (size && refSize && size.base === refSize.base) return (offer.minPrice / size.amount) * refSize.amount;
  return offer.minPrice;
}

/** האם המוצר דומה מספיק כדי להציע אותו כחלופה */
export function isSimilar(candidate: ProductOffer, reference: ProductOffer): boolean {
  if (candidate.id === reference.id || candidate.isWeighted !== reference.isWeighted) return false;
  const word = firstWord(reference.name);
  if (word.length < 3 || firstWord(candidate.name) !== word) return false;
  if (percents(candidate.name) !== percents(reference.name)) return false;
  if (VARIANTS.some((variant) => variant.test(candidate.name) !== variant.test(reference.name))) return false;
  // כל מה שמגדיר את המוצר (סוג, טעם, גרסה) חייב להופיע גם בחלופה; רק המותג יכול להשתנות
  const candidateWords = nameWords(candidate.name);
  if (!definingWords(reference).every((w) => candidateWords.has(w))) return false;
  if (reference.isWeighted) return true;
  // אותו גודל, בטווח של 20%
  if (!reference.quantity || !candidate.quantity || candidate.unit !== reference.unit) return false;
  const ratio = candidate.quantity / reference.quantity;
  return ratio >= 0.8 && ratio <= 1.25;
}

/** החלופה הזולה ביותר שחוסכת לפחות 15% ולפחות חצי שקל, או null */
export function suggestAlternative(reference: ProductOffer, candidates: ProductOffer[], exclude: Set<number> = new Set()): Suggestion | null {
  let best: Suggestion | null = null;
  for (const candidate of candidates) {
    if (exclude.has(candidate.id) || !isSimilar(candidate, reference)) continue;
    const price = comparablePrice(candidate, reference);
    const saving = reference.minPrice - price;
    const savingPct = (saving / reference.minPrice) * 100;
    if (savingPct < MIN_SAVING_PCT || saving < 0.5) continue;
    if (!best || saving > best.saving) best = { product: candidate, saving: Math.round(saving * 100) / 100, savingPct: Math.round(savingPct) };
  }
  return best;
}

/** איך מוצר קשור למוצר שברשימה:
 * same – אותו מוצר ממותג אחר, בגודל דומה; resized – גודל אחר (עד פי 2); multipack – מארז מול יחידה בודדת
 * או מארז בגודל אחר; variety – פרי/ירק מזן אחר (מוצר שקיל). */
export type RelationKind = "same" | "resized" | "multipack" | "variety";

/** browse – לרשימת "מוצרים דומים", מקלה (גדלים, מארזים וזנים, עם מחיר מושווה);
 * basket – לפריט "כל מותג", שנכנס לחישוב הסל: רק אותו גודל בערך, בלי מארזים וזנים */
export type RelationMode = "browse" | "basket";

/** המילה הראשונה בלי סיומת רבים/נקבה: עגבניה, עגבניות ועגבנית נותנות אותו בסיס */
const stem = (word: string) => word.replace(/(יות|ות|ים|יה|ה|ת)$/, "");

export function relation(candidate: ProductOffer, reference: ProductOffer, mode: RelationMode = "browse"): RelationKind | null {
  if (candidate.id === reference.id || candidate.isWeighted !== reference.isWeighted) return null;
  const word = firstWord(reference.name);
  const candidateFirst = firstWord(candidate.name);
  if (word.length < 3) return null;
  const sameFirst = candidateFirst === word;
  // ירקות ופירות: זן אחר יכול להתחיל בצורה אחרת של אותה מילה (עגבניה / עגבניות שרי)
  const produce = mode === "browse" && reference.isWeighted;
  if (!sameFirst && !(produce && stem(candidateFirst).length >= 3 && stem(candidateFirst) === stem(word))) return null;
  if (percents(candidate.name) !== percents(reference.name)) return null;
  if (VARIANTS.some((variant) => variant.test(candidate.name) !== variant.test(reference.name))) return null;
  // שם המותג לא תמיד בשדה היצרן (שם יש לפעמים את המפיץ): מותרת מילה אחת שונה בכל צד, זה בדרך כלל המותג
  const candidateWords = nameWords(candidate.name);
  const referenceWords = nameWords(reference.name);
  const missing = definingWords(reference).filter((w) => !candidateWords.has(w) && !(produce && w === word)).length;
  const extra = definingWords(candidate).filter((w) => !referenceWords.has(w) && !(produce && w === candidateFirst)).length;
  if (missing > 1) return null;
  if (extra > 1) return produce && extra <= 3 ? "variety" : null;
  if (reference.isWeighted) return produce && (!sameFirst || extra > 0) ? "variety" : "same";

  const size = sizeOf(candidate);
  const refSize = sizeOf(reference);
  const multipack = packCount(candidate.name) !== packCount(reference.name);
  if (!size || !refSize || size.base !== refSize.base) {
    // גודל לא ידוע באחד מהם: רק כשאין הבדל במארז ואותה כמות רשומה
    return !multipack && candidate.quantity === reference.quantity && !(size && refSize) ? "same" : null;
  }
  const ratio = size.amount / refSize.amount;
  if (mode === "basket") return !multipack && ratio >= 0.8 && ratio <= 1.25 ? "same" : null;
  if (multipack) return ratio >= 1 / 8 && ratio <= 8 ? "multipack" : null;
  if (ratio < 0.5 || ratio > 2) return null;
  return Math.abs(ratio - 1) < 0.01 ? "same" : "resized";
}

/** מוצר דומה לרשימת "מוצרים דומים ומותגים אחרים" */
export function isRelated(candidate: ProductOffer, reference: ProductOffer): boolean {
  return relation(candidate, reference) != null;
}

export type Related = {
  product: ProductOffer;
  /** המחיר לאריזה בגודל של המוצר המקורי (כשהגדלים ידועים) */
  comparablePrice: number;
  kind: RelationKind;
  /** הגודל שונה מהמקורי, והמחיר המושווה חושב לפי משקל/נפח/יחידות */
  resized: boolean;
};

/** מוצרים דומים למוצרי הפריט, מהזול ליקר לפי המחיר המושווה. מוצרים שכבר בפריט, או שהמשתמש סימן "לא דומה",
 * לא נכללים. */
export function relatedProducts(
  references: ProductOffer[],
  candidates: ProductOffer[],
  exclude: Set<number>,
  limit = 12,
  mode: RelationMode = "browse",
): Related[] {
  const best = new Map<number, Related>();
  for (const reference of references) {
    for (const candidate of candidates) {
      if (exclude.has(candidate.id)) continue;
      const kind = relation(candidate, reference, mode);
      if (!kind) continue;
      const price = Math.round(comparablePrice(candidate, reference) * 100) / 100;
      const prev = best.get(candidate.id);
      if (!prev || price < prev.comparablePrice) {
        best.set(candidate.id, { product: candidate, comparablePrice: price, kind, resized: kind === "resized" || kind === "multipack" });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.comparablePrice - b.comparablePrice).slice(0, limit);
}
