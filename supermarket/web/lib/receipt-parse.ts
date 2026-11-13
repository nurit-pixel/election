import type { ReceiptLine } from "./receipt-match";

/** פענוח טקסט של חשבונית (פלט OCR או PDF דיגיטלי) לשורות מוצרים. לוגיקה טהורה. */

// שורות שאינן מוצר: סיכומים, הנחות, תשלום, פרטי החנות
const SKIP = new RegExp(
  [
    // סיכומים, הנחות ותשלום
    'סה["״\']?כ', "סהכ", "סיכום", "סך", 'מע["״\']?מ', "הנח[הת]", "מבצע", "זיכוי", "החזר", "הטבה", "פי?קדון",
    "שקית", "שקיות", "אשראי", "מזומן", "עודף", "לתשלום", "שולם", "תשלום", "תשלומים", "יתרה", "עיגול",
    "ויזה", "מאסטרקארד", "מסטרקארד", "ישראכרט", "אמריקן", "דיינרס", "ביט", "תו קנייה", "שובר", "קופון",
    // מועדון ונקודות
    "מועדון", "חסכת", "חיסכון", "נקודות", "צבירה", "נצברו", "צברת", "חבר יקר",
    // פרטי החנות והעסקה
    "קופה", "קופאי", "חשבונית", "קבלה", "טלפון", "טל[.:]", "פקס", "תאריך", "שעה", "ח\\s*\\.\\s*פ", "ח\\.?פ\\s*\\d",
    "ע\\s*\\.\\s*מ", "עוסק", "כרטיס", "סניף", "כתובת", "רחוב", "רח['׳]", 'בע["״\']?מ', "תודה", "להתראות", "משלוח",
    "פריטים", "אישור", "מסוף", "עסקה", "מספר", "מס['׳]", "לקוח", "ת\\.?ז", "מקור", "העתק", "נאמן למקור", "www", "@",
  ].join("|"),
  "i",
);

const PRICE = /-?\d{1,4}[.,]\d{2}(?!\d)-?/g;
const BARCODE = /(?<!\d)\d{7,14}(?!\d)/;
// קוד פנימי קצר של הרשת: מודפס בתחילת שורת המוצר
const SHORT_CODE = /^(\d{4,6})\s+(?=\S*[א-ת])/;
const WEIGHT = /(\d{1,2}[.,]\d{1,3})\s*(?:ק["״']?ג|קילו|kg)/i;
const UNITS = [
  /(?:^|\s)(\d{1,3})\s*[xX×*]\s*\d/, // 2 X 5.90
  /\d\s*[xX×*]\s*(\d{1,3})(?:\s|$)/, // 5.90 X 2
  /[xX×*]\s*\d{1,4}[.,]\d{2}\s+(\d{1,3})(?:\s|$)/, // X 7.90 2 (סדר הפוך ב-PDF)
  /כמות:?\s*(\d{1,3})(?!\d|[.,]\d)/,
  /(?:^|\s)(\d{1,3})\s*יח/,
];
// מילים שמתארות כמות ומחיר ואינן חלק משם המוצר
const NOISE = /ק["״']?ג|קילו|kg|יח['׳]?|יחידות|כמות|מחיר|ליח['׳]?|[xX×*]/gi;

const number = (text: string) => Number(text.replace(",", "."));
const hebrewLetters = (text: string) => (text.match(/[א-ת]/g) ?? []).length;

type Draft = ReceiptLine & { hasQuantity: boolean };

export function parseReceiptText(text: string): ReceiptLine[] {
  const drafts: Draft[] = [];
  let last: Draft | null = null;
  let pendingBarcode: string | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
      // OCR מדביק לפעמים "2 X 7.90" ל-"X7.902"
      .replace(/([xX×*])\s*(\d{1,4}[.,]\d{2})(\d{1,3})(?=\s|$)/, "$3 $1 $2")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) continue;
    if (SKIP.test(line)) {
      last = null;
      pendingBarcode = null;
      continue;
    }

    const barcode = line.match(BARCODE)?.[0] ?? null;
    let rest = barcode ? line.replace(barcode, " ") : line;
    const shortCode = barcode ? null : (rest.match(SHORT_CODE)?.[1] ?? null);
    if (shortCode) rest = rest.replace(SHORT_CODE, "");

    const weight = rest.match(WEIGHT);
    let units: number | null = null;
    let unitsText: string | null = null;
    for (const [index, pattern] of UNITS.entries()) {
      const found = rest.match(pattern);
      if (found) {
        units = Number(found[1]);
        // "כמות 2" / "2 יח" אינם חלק משם המוצר; ב-"2 X 5.90" המספר נשאר לבד ואינו שם
        if (index >= 3) unitsText = found[0];
        break;
      }
    }

    const prices = (rest.match(PRICE) ?? []).map((p) => ({ value: number(p.replace(/-/g, "")), negative: p.includes("-") }));
    if (weight) rest = rest.replace(weight[0], " ");
    if (unitsText) rest = rest.replace(unitsText, " ");
    rest = rest.replace(PRICE, " ");
    const name = rest
      .replace(NOISE, " ")
      .replace(/\s+/g, " ")
      .replace(/^[^א-תa-zA-Z0-9]+|[^א-תa-zA-Z0-9%]+$/g, "")
      .trim();

    const quantity = weight ? number(weight[1]) : units;
    const isProduct = hebrewLetters(name) >= 2 && (prices.length > 0 || barcode != null);

    if (isProduct) {
      if (prices.length > 0 && prices.every((p) => p.negative)) {
        last = null; // שורת הנחה
        continue;
      }
      const draft: Draft = {
        printed: name.slice(0, 120),
        name: name.slice(0, 120),
        barcode: barcode ?? pendingBarcode ?? shortCode,
        unit: weight ? "kg" : "unit",
        quantity: quantity && quantity > 0 ? quantity : 1,
        total: prices.length ? prices[prices.length - 1].value : null,
        hasQuantity: quantity != null,
      };
      pendingBarcode = null;
      drafts.push(draft);
      last = draft;
      continue;
    }

    // שורת המשך: כמות, משקל או ברקוד של המוצר שמעליה
    if (last && hebrewLetters(name) < 2) {
      if (quantity != null && quantity > 0 && !last.hasQuantity) {
        last.quantity = quantity;
        last.unit = weight ? "kg" : "unit";
        last.hasQuantity = true;
        const positive = prices.filter((p) => !p.negative);
        if (positive.length > 1 || (positive.length === 1 && last.total == null)) {
          last.total = positive[positive.length - 1].value;
        }
      }
      if (barcode && (!last.barcode || last.barcode.length < 7)) last.barcode = barcode;
      else if (barcode && barcode !== last.barcode) pendingBarcode = barcode;
    } else if (!last && barcode && hebrewLetters(name) < 2) {
      pendingBarcode = barcode; // ברקוד שמודפס מעל שם המוצר
    }
  }

  // אותו מוצר בכמה שורות: שורה אחת עם הכמות המצטברת
  const merged = new Map<string, ReceiptLine>();
  for (const { hasQuantity: _ignored, ...line } of drafts) {
    const key = line.barcode ?? `name:${line.printed}`;
    const existing = merged.get(key);
    if (existing && existing.unit === line.unit) {
      existing.quantity = Math.round((existing.quantity + line.quantity) * 1000) / 1000;
      if (existing.total != null && line.total != null) existing.total = Math.round((existing.total + line.total) * 100) / 100;
    } else {
      merged.set(existing ? `${key}:${merged.size}` : key, line);
    }
  }
  return productLines([...merged.values()]).slice(0, 150);
}

/** שורה בלי קוד נחשבת מוצר רק אם היא נראית כמו שם של מוצר עם מחיר, ולא כמו טקסט אחר שבחשבונית. */
export function looksLikeProduct(line: Pick<ReceiptLine, "printed" | "total">): boolean {
  const name = line.printed;
  const letters = hebrewLetters(name);
  const visible = name.replace(/\s/g, "").length;
  return (
    line.total != null &&
    line.total > 0 &&
    line.total < 2000 &&
    name.length <= 60 &&
    letters >= 4 &&
    letters / visible >= 0.5 &&
    /[א-ת]{3}/.test(name)
  );
}

/** בחירת שורות המוצרים. חשבונית שמדפיסה ברקודים מזוהה לפי הברקודים בלבד: שורה בלי ברקוד היא
 * טקסט אחר (כותרת, מבצע, פרטי תשלום). רק בחשבונית בלי קודים בכלל מסתמכים על שם ומחיר. */
export function productLines(lines: ReceiptLine[]): ReceiptLine[] {
  // קוד = ברקוד מלא, או קוד פנימי קצר של הרשת (למשל לפירות וירקות)
  const coded = lines.filter((l) => l.barcode != null);
  if (coded.length >= 2 || (coded.length === 1 && lines.length <= 2)) return coded;
  return lines.filter(looksLikeProduct);
}

const LONG_CODE = /(?<!\d)\d{7,14}(?!\d)/;
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** שילוב שתי קריאות OCR של אותה תמונה. המודל העברי קורא היטב שמות אבל משבש רצפי ספרות ארוכים
 * (ברקוד), ומודל הספרות קורא היטב ברקודים ומחירים אבל לא עברית. הברקוד שנקרא בקריאת הספרות
 * מוצמד לשורה המתאימה בקריאה העברית: לפי מספר השורה כששתי הקריאות חילקו את הדף לאותן שורות,
 * אחרת לפי המחירים שמופיעים בשורה. */
export function mergeDigitPass(text: string, digits: string): string {
  const split = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.replace(BIDI_MARKS, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const lines = split(text);
  const digitLines = split(digits);
  const pricesOf = (line: string): string[] => line.match(/\d{1,4}\.\d{2}(?!\d)/g) ?? [];
  // הספרות הבודדות שנשארו מהברקוד המשובש בתחילת השורה מוחלפות בברקוד המלא
  const withCode = (line: string, code: string) => `${code} ${line.replace(/^\d{1,6}(?=\s)/, "").trim()}`;

  if (lines.length === digitLines.length) {
    return lines
      .map((line, index) => {
        const code = digitLines[index].match(LONG_CODE)?.[0];
        return code && !LONG_CODE.test(line) ? withCode(line, code) : line;
      })
      .join("\n");
  }
  for (const digitLine of digitLines) {
    const code = digitLine.match(LONG_CODE)?.[0];
    const prices = pricesOf(digitLine);
    if (!code || prices.length === 0 || lines.some((line) => line.includes(code))) continue;
    const matches = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => !LONG_CODE.test(line) && prices.every((p) => pricesOf(line).includes(p)));
    if (matches.length === 1) lines[matches[0].index] = withCode(matches[0].line, code);
  }
  return lines.join("\n");
}

/** ספרת הביקורת של ברקוד (EAN-13, UPC-A, EAN-8, GTIN-14) תקינה. מספר טלפון או מספר חשבונית כמעט אף פעם לא עוברים. */
export function validBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // מהספרה שלפני ספרת הביקורת ואחורה: משקל 3, 1, 3, 1...
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** ברקודים תקינים שנבדלים מהקוד בספרה אחת. משמש לתיקון ספרה ש-OCR קרא לא נכון. */
export function barcodeVariants(code: string): string[] {
  const variants: string[] = [];
  for (let i = 0; i < code.length; i++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === code[i]) continue;
      const candidate = code.slice(0, i) + d + code.slice(i + 1);
      if (validBarcode(candidate)) variants.push(candidate);
    }
  }
  return variants;
}

const PRICE_TOKEN = /\d{1,4}[.,]\d{2}(?!\d)/g;

/** שורות המוצרים מתוך שתי קריאות OCR של צילום: רשימת המוצרים נבנית מהברקודים שבקריאת הספרות,
 * כי בצילום אמיתי השמות בעברית יוצאים משובשים והברקודים כמעט תמיד נכונים. השם (אם נמצא) נלקח
 * מהקריאה העברית לפי המחיר שבאותה שורה, ומשמש רק לתצוגה ולחיפוש כשהברקוד לא במאגר.
 * מחזיר null כשאין בצילום לפחות שני ברקודים תקינים; אז מפענחים את הטקסט בדרך הרגילה. */
export function linesFromPasses(text: string, digits: string): ReceiptLine[] | null {
  const split = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.replace(BIDI_MARKS, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const digitLines = split(digits);
  const longCodes = (line: string) => (line.match(/(?<![\d.,])\d{12,14}(?![\d.,])/g) ?? []) as string[];
  const hasValid = digitLines.map((line) => longCodes(line).some(validBarcode));
  if (hasValid.filter(Boolean).length < 2) return null;
  // אזור המוצרים: מהברקוד התקין הראשון עד האחרון. מה שמעליו ומתחתיו הוא כותרת, טלפון ותשלום
  const first = hasValid.indexOf(true);
  const last = hasValid.lastIndexOf(true);

  // שמות מהקריאה העברית, לפי מחיר: לכל מחיר, השורות שמכילות אותו, בסדר הופעתן
  const named = split(text)
    .filter((line) => !SKIP.test(line))
    .map((line) => ({
      prices: ((line.match(PRICE_TOKEN) ?? []) as string[]).map(number),
      name: line
        .replace(PRICE_TOKEN, " ")
        .replace(/\d{5,}/g, " ")
        .replace(NOISE, " ")
        .replace(/[^א-ת0-9%&'"״׳ -]/g, " ")
        .replace(/(^|\s)\d{1,2}(?=\s|$)/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      used: false,
    }))
    .filter((line) => hebrewLetters(line.name) >= 3);
  const nameFor = (prices: number[]): string => {
    const found = named.find((line) => !line.used && prices.some((p) => line.prices.includes(p)));
    if (!found) return "";
    found.used = true;
    return found.name.slice(0, 120);
  };

  const lines: ReceiptLine[] = [];
  const seen = new Set<string>();
  for (let i = first; i <= last; i++) {
    const line = digitLines[i];
    const prices = ((line.match(PRICE_TOKEN) ?? []) as string[]).map(number);
    let codes = longCodes(line);
    if (codes.length === 0) {
      // קוד פנימי קצר של הרשת (למשל לירקות): מספר בודד של 5–7 ספרות בשורה, שאינו חלק ממחיר
      const short = (line.match(/(?<![\d.,])\d{5,7}(?![\d.,])/g) ?? []) as string[];
      if (short.length === 1) codes = short;
    }
    for (const code of codes) {
      if (seen.has(code)) continue;
      seen.add(code);
      lines.push({
        printed: nameFor(prices),
        name: "",
        barcode: code,
        unit: "unit",
        quantity: 1,
        total: prices.length > 0 ? Math.max(...prices) : null,
      });
    }
  }
  return lines.map((line) => ({ ...line, name: line.printed })).slice(0, 150);
}
