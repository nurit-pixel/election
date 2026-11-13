import type { ReceiptLine } from "./receipt-match";

/** פענוח טקסט של חשבונית (פלט OCR או PDF דיגיטלי) לשורות מוצרים. לוגיקה טהורה. */

// שורות שאינן מוצר: סיכומים, הנחות, תשלום, פרטי החנות
const SKIP =
  /סה["״']?כ|סהכ|סיכום|מע["״']?מ|הנח[הת]|מבצע|זיכוי|פי?קדון|שקית|שקיות|אשראי|מזומן|עודף|לתשלום|שולם|תשלום|קופה|קופאי|חשבונית|קבלה|טלפון|טל[.:]|תאריך|ח\s*\.\s*פ|ח\.?פ\s*\d|עוסק|כרטיס|מועדון|חסכת|חיסכון|נקודות|שובר|קופון|סניף|תודה|משלוח|עיגול|פריטים|www|@/i;

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
  return [...merged.values()].slice(0, 150);
}
