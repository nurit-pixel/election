/** לוגיקה טהורה של ייבוא חשבונית: מה מחפשים לכל שורה, כמה מוסיפים לרשימה, ומה מסומן מראש. */

export type ReceiptLine = {
  /** השם כפי שהודפס בחשבונית */
  printed: string;
  /** השם המלא המשוער של המוצר, בלי קיצורים */
  name: string;
  /** הקוד שהודפס ליד המוצר: ברקוד, או קוד פנימי קצר של הרשת */
  barcode: string | null;
  unit: "unit" | "kg";
  /** יחידות, או ק״ג כשהיחידה היא kg */
  quantity: number;
  /** הסכום ששולם על השורה, אם הודפס */
  total: number | null;
};

/** barcode: זוהה לפי הקוד שבחשבונית · name: כל מילות השם נמצאו · loose: התאמה חלקית, דורש בדיקה */
export type Confidence = "barcode" | "name" | "loose" | "none";

export type Candidate = {
  id: number;
  name: string;
  manufacturer: string | null;
  isWeighted: boolean;
  /** מוצר עם קוד פנימי: שם הרשת היחידה שמוכרת אותו */
  chainName: string | null;
  /** המחיר הזול ביותר בסניפים שבסביבה */
  minPrice: number | null;
};

export type MatchedLine = ReceiptLine & { confidence: Confidence; candidates: Candidate[] };

/** ברקוד אמיתי (7–14 ספרות) בלי אפסים מובילים. קודים קצרים הם קודים פנימיים של הרשת ואינם ניתנים להשוואה. */
export function normalizeBarcode(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 14) return null;
  const trimmed = digits.replace(/^0+/, "");
  return trimmed.length >= 6 ? trimmed : null;
}

/** קוד פנימי קצר של רשת (4–6 ספרות), בלי אפסים מובילים. */
export function normalizeShortCode(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 6) return null;
  const trimmed = digits.replace(/^0+/, "");
  return trimmed.length >= 3 ? trimmed : null;
}

/** קוד קצר חוזר על עצמו בין רשתות, ולכן הוא נחשב זיהוי בטוח רק כשיש מוצר אחד ושמו חולק מילה עם השורה. */
export function shortCodeIsCertain(printed: string, candidates: Pick<Candidate, "name">[]): boolean {
  if (candidates.length !== 1) return false;
  const tokens = words(printed).filter((w) => w.length >= 3 && !/\d/.test(w));
  return tokens.some((w) => candidates[0].name.includes(w));
}

const words = (text: string) =>
  text
    .replace(/["'״׳`.,;:()\[\]*+\/\\|_-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 || /\d/.test(w));

/** שאילתות חיפוש לשורה, מהמדויקת לרחבה. exact מסמן שכל מילות השם, כולל גדלים ואחוזים, נדרשות. */
export function queryVariants(line: Pick<ReceiptLine, "name" | "printed">): { query: string; exact: boolean }[] {
  const variants: { query: string; exact: boolean }[] = [];
  const push = (tokens: string[], exact: boolean) => {
    const query = tokens.slice(0, 6).join(" ");
    if (query.length >= 2 && !variants.some((v) => v.query === query)) variants.push({ query, exact });
  };
  for (const source of [line.name, line.printed]) {
    const all = words(source);
    const core = all.filter((w) => !/\d/.test(w) && !w.includes("%"));
    push(all, true);
    // בלי גדלים ואחוזים ההתאמה כבר לא חד-משמעית (3% מול 1%, 200 גרם מול 500)
    if (core.length >= 2) push(core, core.length === all.length);
    if (core.length > 2) push(core.slice(0, 2), false);
    if (core.length > 1 && core[0].length >= 3) push(core.slice(0, 1), false);
  }
  return variants;
}

/** הכמות שתיכנס לרשימה: ק״ג למוצר שקיל, יחידות שלמות לכל השאר. */
export function listQuantity(line: Pick<ReceiptLine, "unit" | "quantity">, isWeighted: boolean): number {
  const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1;
  if (isWeighted) return line.unit === "kg" ? Math.min(Math.round(quantity * 1000) / 1000, 999) : 1;
  return line.unit === "unit" ? Math.min(Math.max(1, Math.round(quantity)), 999) : 1;
}

/** המוצר שמסומן מראש במסך האישור: רק כשההתאמה בטוחה. התאמה חלקית נשארת לבחירת המשתמש. */
export function preselected(line: Pick<MatchedLine, "confidence" | "candidates">): number | null {
  if (line.candidates.length === 0) return null;
  return line.confidence === "barcode" || line.confidence === "name" ? line.candidates[0].id : null;
}
