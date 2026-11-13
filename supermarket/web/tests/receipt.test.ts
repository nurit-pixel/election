import { describe, expect, it } from "vitest";
import { listQuantity, normalizeBarcode, preselected, queryVariants, type Candidate } from "../lib/receipt-match";

const candidate = (id: number): Candidate => ({ id, name: `מוצר ${id}`, manufacturer: null, isWeighted: false, minPrice: 5 });

describe("ברקוד מחשבונית", () => {
  it("מסיר אפסים מובילים ותווים שאינם ספרות", () => {
    expect(normalizeBarcode("0729000004 1234".replace(" ", ""))).toBe("7290000041234");
    expect(normalizeBarcode("7290-0000-41234")).toBe("7290000041234");
  });
  it("קוד קצר הוא קוד פנימי של הרשת ולא ברקוד", () => {
    expect(normalizeBarcode("4011")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
    expect(normalizeBarcode(null)).toBeNull();
  });
});

describe("שאילתות חיפוש לשורה", () => {
  it("מתחיל מהשם המלא ומתרחב בהדרגה", () => {
    const variants = queryVariants({ name: "חלב תנובה 3% 1 ליטר", printed: "חלב תנ 3% 1ל" });
    expect(variants[0]).toEqual({ query: "חלב תנובה 3% 1 ליטר", exact: true });
    expect(variants[1]).toEqual({ query: "חלב תנובה ליטר", exact: false });
    expect(variants.find((v) => v.query === "חלב תנובה")).toEqual({ query: "חלב תנובה", exact: false });
    expect(variants.some((v) => v.query === "חלב" && !v.exact)).toBe(true);
  });
  it("לא חוזר על אותה שאילתה ומנקה סימני פיסוק", () => {
    const variants = queryVariants({ name: 'קוטג\' 5% (250 גר")', printed: "קוטג' 5%" });
    expect(new Set(variants.map((v) => v.query)).size).toBe(variants.length);
    expect(variants[0].query).toBe("קוטג 5% 250 גר");
  });
  it("שם של מילה אחת נשאר חיפוש מדויק", () => {
    expect(queryVariants({ name: "במבה", printed: "במבה" })).toEqual([{ query: "במבה", exact: true }]);
  });
});

describe("כמות לרשימה", () => {
  it("מוצר שקיל מקבל את המשקל בק״ג", () => {
    expect(listQuantity({ unit: "kg", quantity: 0.7524 }, true)).toBe(0.752);
  });
  it("מוצר רגיל מקבל יחידות שלמות", () => {
    expect(listQuantity({ unit: "unit", quantity: 3 }, false)).toBe(3);
  });
  it("אי התאמה בין החשבונית למוצר: ברירת מחדל 1", () => {
    expect(listQuantity({ unit: "kg", quantity: 0.75 }, false)).toBe(1);
    expect(listQuantity({ unit: "unit", quantity: 2 }, true)).toBe(1);
    expect(listQuantity({ unit: "unit", quantity: Number.NaN }, false)).toBe(1);
  });
});

describe("סימון מראש במסך האישור", () => {
  it("ברקוד או שם מלא: המוצר הראשון מסומן", () => {
    expect(preselected({ confidence: "barcode", candidates: [candidate(7)] })).toBe(7);
    expect(preselected({ confidence: "name", candidates: [candidate(3), candidate(4)] })).toBe(3);
  });
  it("התאמה חלקית או ללא מועמדים: שום דבר לא מסומן", () => {
    expect(preselected({ confidence: "loose", candidates: [candidate(3)] })).toBeNull();
    expect(preselected({ confidence: "none", candidates: [] })).toBeNull();
  });
});

import { parseReceiptText } from "../lib/receipt-parse";

describe("פענוח טקסט של חשבונית", () => {
  const text = [
    "סופר הדוגמה בע\"מ   ח.פ 512345678",
    "סניף 12 פתח תקווה  טלפון 03-1234567",
    "7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80",
    "2 X 7.90",
    "במבה אסם 80 גרם 4.90",
    "מלפפון 4.44",
    "0.752 ק\"ג X 5.90",
    "הנחת מבצע 2.00-",
    "קוטג 5% 250 גרם 6.10",
    "7290004127329",
    "פיקדון בקבוק 0.30",
    "סה\"כ לתשלום 31.24",
    "אשראי ויזה 31.24",
  ].join("\n");
  const lines = parseReceiptText(text);

  it("מוציא רק שורות מוצרים", () => {
    expect(lines.map((l) => l.printed)).toEqual([
      "חלב בקבוק 3% יטבתה 1 ל",
      "במבה אסם 80 גרם",
      "מלפפון",
      "קוטג 5% 250 גרם",
    ]);
  });
  it("ברקוד באותה שורה או בשורה שמתחת", () => {
    expect(lines[0].barcode).toBe("7290000042411");
    expect(lines[3].barcode).toBe("7290004127329");
    expect(lines[1].barcode).toBeNull();
  });
  it("כמות ומשקל משורת ההמשך", () => {
    expect(lines[0]).toMatchObject({ unit: "unit", quantity: 2, total: 15.8 });
    expect(lines[1]).toMatchObject({ unit: "unit", quantity: 1, total: 4.9 });
    expect(lines[2]).toMatchObject({ unit: "kg", quantity: 0.752, total: 4.44 });
  });
  it("אותו מוצר פעמיים: שורה אחת עם כמות מצטברת", () => {
    const twice = parseReceiptText("במבה אסם 80 גרם 4.90\nבמבה אסם 80 גרם 4.90");
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ quantity: 2, total: 9.8 });
  });
  it("טקסט שאינו חשבונית: אין שורות", () => {
    expect(parseReceiptText("שלום עולם\nזה סתם מסמך")).toEqual([]);
  });
});

describe("פענוח פלט OCR אמיתי", () => {
  it("כמות שהודבקה למחיר ותווי כיווניות", () => {
    const lines = parseReceiptText("7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80\n\u200eX7.902\u200f\n\u200fבמבה אסם 80 גרם 4.90");
    expect(lines[0]).toMatchObject({ barcode: "7290000042411", quantity: 2, total: 15.8 });
    expect(lines[1]).toMatchObject({ printed: "במבה אסם 80 גרם", quantity: 1 });
  });
});

describe("סדר הפוך של כמות ב-PDF", () => {
  it("X 7.90 2 הוא שתי יחידות", () => {
    const lines = parseReceiptText("7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80\nX 7.90 2");
    expect(lines[0]).toMatchObject({ quantity: 2, unit: "unit" });
  });
});

describe("פרטי החנות ב-PDF", () => {
  it("מספר ח.פ אינו ברקוד של מוצר", () => {
    expect(parseReceiptText("\u202bח\u202a.\u202cפ \u202a512345678\u202c\u202c\nסופר הדוגמה בע\"מ")).toEqual([]);
  });
});
