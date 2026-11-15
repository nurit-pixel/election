/** הצעה לחלופה זולה למוצר ברשימה: מוצר דומה (אותה מילה ראשונה, אותו גודל ואחוז שומן) שזול לפחות ב-15%. לוגיקה טהורה. */

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
  /(?:^|[\s\d])XL(?=$|\s)/, /בינוני/, /גדול/, /קטן/, /ענק/,
];

/** מילות יחידה ומידה, שאינן חלק מזהות המוצר */
const UNIT_WORDS = new Set(["גרם", "גר", "ג", "מל", "מ", "ליטר", "ל", "קג", "ק", "יח", "יחידות", "יחידה", "מארז", "שישייה", "אריזה"]);

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

/** מחיר להשוואה: לאריזה בגודל של המוצר המקורי, כשהגדלים ידועים; אחרת המחיר כמו שהוא */
function comparablePrice(offer: ProductOffer, reference: ProductOffer): number {
  if (offer.quantity && reference.quantity && offer.unit === reference.unit && offer.quantity > 0) {
    return (offer.minPrice / offer.quantity) * reference.quantity;
  }
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
