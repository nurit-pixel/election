import { describe, expect, it } from "vitest";
import { normalizeBarcode, preselected, queryVariants, type Candidate } from "../lib/receipt-match";

const candidate = (id: number): Candidate => ({ id, name: `מוצר ${id}`, manufacturer: null, isWeighted: false, chainName: null, minPrice: 5 });

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

import { looksLikeProduct, mergeDigitPass, parseReceiptText } from "../lib/receipt-parse";

describe("חשבונית שמדפיסה קודים", () => {
  const text = [
    "סופר הדוגמה בע\"מ   ח.פ 512345678",
    "סניף 12 פתח תקווה  טלפון 03-1234567",
    "7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80",
    "2 X 7.90",
    "40112 מלפפון 4.44",
    "0.752 ק\"ג X 5.90",
    "הנחת מבצע 2.00-",
    "קוטג 5% 250 גרם 6.10",
    "7290004127329",
    "חבר יקר, צברת היום 12.00",
    "ברוכים הבאים לסופר 1.00",
    "פיקדון בקבוק 0.30",
    "סה\"כ לתשלום 31.24",
    "אשראי ויזה 31.24",
    "מספר אישור 0012345678",
  ].join("\n");
  const lines = parseReceiptText(text);

  it("רק שורות עם קוד הן מוצרים; טקסט אחר עם מחיר אינו מוצר", () => {
    expect(lines.map((l) => l.printed)).toEqual(["חלב בקבוק 3% יטבתה 1 ל", "מלפפון", "קוטג 5% 250 גרם"]);
  });
  it("ברקוד באותה שורה, קוד קצר של הרשת, או ברקוד בשורה שמתחת", () => {
    expect(lines.map((l) => l.barcode)).toEqual(["7290000042411", "40112", "7290004127329"]);
  });
  it("אותו מוצר פעמיים: שורה אחת", () => {
    const twice = parseReceiptText("7290000066295 במבה אסם 80 גרם 4.90\n7290000066295 במבה אסם 80 גרם 4.90\n7290000042411 חלב 6.90");
    expect(twice.map((l) => l.barcode)).toEqual(["7290000066295", "7290000042411"]);
  });
});

describe("חשבונית בלי קודים", () => {
  it("מוצר הוא שורה עם שם בעברית ומחיר", () => {
    const lines = parseReceiptText("במבה אסם 80 גרם 4.90\nמלפפון 4.44\nקוטג 5% 250 גרם 6.10");
    expect(lines.map((l) => l.printed)).toEqual(["במבה אסם 80 גרם", "מלפפון", "קוטג 5% 250 גרם"]);
  });
  it("שורות שאינן נראות כמו מוצר נזרקות", () => {
    expect(looksLikeProduct({ printed: "במבה אסם 80 גרם", total: 4.9 })).toBe(true);
    expect(looksLikeProduct({ printed: "במבה אסם 80 גרם", total: null })).toBe(false); // בלי מחיר
    expect(looksLikeProduct({ printed: "אב 12 34 56 78", total: 5 })).toBe(false); // בעיקר ספרות
    expect(looksLikeProduct({ printed: "גב צ", total: 5 })).toBe(false); // קצר מדי
    expect(looksLikeProduct({ printed: "במבה", total: 25000 })).toBe(false); // סכום לא סביר למוצר
    expect(looksLikeProduct({ printed: "א".repeat(70), total: 5 })).toBe(false); // ארוך מדי לשם מוצר
  });
  it("טקסט שאינו חשבונית: אין שורות", () => {
    expect(parseReceiptText("שלום עולם\nזה סתם מסמך")).toEqual([]);
  });
});

describe("פענוח פלט OCR אמיתי", () => {
  it("תווי כיווניות וכמות שהודבקה למחיר לא מפריעים לזיהוי הקוד", () => {
    const lines = parseReceiptText(
      "7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80\n\u200eX7.902\u200f\n\u200f7290000066295 במבה אסם 80 גרם 4.90",
    );
    expect(lines.map((l) => l.barcode)).toEqual(["7290000042411", "7290000066295"]);
    expect(lines[1].printed).toBe("במבה אסם 80 גרם");
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

import { normalizeShortCode, shortCodeIsCertain } from "../lib/receipt-match";

describe("קוד פנימי קצר של הרשת", () => {
  it("נלקח מתחילת שורת המוצר ולא מגודל האריזה", () => {
    const lines = parseReceiptText("40112 עגבניה שרי 6.90\nקמח לבן 1000 גרם 4.50\n40227 בצל יבש 3.20");
    expect(lines.map((l) => [l.barcode, l.printed])).toEqual([
      ["40112", "עגבניה שרי"],
      ["40227", "בצל יבש"],
    ]);
  });
  it("ברקוד מלא בשורה שמתחת גובר על קוד קצר", () => {
    const lines = parseReceiptText("40112 עגבניה שרי 6.90\n7290000042411");
    expect(lines[0].barcode).toBe("7290000042411");
  });
  it("אורך הקוד: 4 עד 6 ספרות", () => {
    expect(normalizeShortCode("040112")).toBe("40112");
    expect(normalizeShortCode("123")).toBeNull();
    expect(normalizeShortCode("7290000042411")).toBeNull();
  });
  it("זיהוי בטוח רק כשיש מוצר אחד ששמו תואם לשורה", () => {
    expect(shortCodeIsCertain("עגבניה שרי", [{ name: "עגבניה שרי אשכולות" }])).toBe(true);
    expect(shortCodeIsCertain("עגבניה שרי", [{ name: "מלפפון" }])).toBe(false);
    expect(shortCodeIsCertain("עגבניה שרי", [{ name: "עגבניה שרי" }, { name: "עגבניה תמר" }])).toBe(false);
  });
});

describe("שילוב קריאת הספרות עם הקריאה העברית", () => {
  // פלט אמיתי של שתי הקריאות על אותה חשבונית
  const hebrew = [
    'סופר הדוגמה בע"מ',
    "7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80",
    "95 במבה מתוקה 30 גרם 7.80",
    "כמות 3",
    "84 ביצים 12 יח גדול 13.90",
    "חבר יקר צברת היום 12.00",
  ].join("\n");
  const digits = [
    'n"yr ANITA 910',
    "15.80 7 1 anlv' 3% piaja ayn 7290000042411",
    "7.80 072 30 Ay7INN AANA 7290000066295",
    "3 nim>",
    "13.90 7172 n':12 oN 7290015710084",
    "12.00 DNN NAY 47! Nan",
  ].join("\n");

  it("ברקוד שהמודל העברי שיבש מוחלף בברקוד המלא, לפי מספר השורה", () => {
    const merged = mergeDigitPass(hebrew, digits).split("\n");
    expect(merged[2]).toBe("7290000066295 במבה מתוקה 30 גרם 7.80");
    expect(merged[4]).toBe("7290015710084 ביצים 12 יח גדול 13.90");
    expect(merged[1]).toBe("7290000042411 חלב בקבוק 3% יטבתה 1 ל 15.80"); // כבר היה תקין
    expect(merged[5]).toBe("חבר יקר צברת היום 12.00"); // שורה בלי ברקוד לא משתנה
  });
  it("אחרי השילוב כל המוצרים מזוהים לפי ברקוד, והטקסט האחר נזרק", () => {
    const lines = parseReceiptText(mergeDigitPass(hebrew, digits));
    expect(lines.map((l) => l.barcode)).toEqual(["7290000042411", "7290000066295", "7290015710084"]);
  });
  it("כשמספר השורות שונה, הברקוד מוצמד לפי המחיר שבשורה", () => {
    const shorter = digits.split("\n").slice(1).join("\n"); // קריאת הספרות פספסה את שורת הכותרת
    const merged = mergeDigitPass(hebrew, shorter).split("\n");
    expect(merged[2]).toBe("7290000066295 במבה מתוקה 30 גרם 7.80");
    expect(merged[4]).toBe("7290015710084 ביצים 12 יח גדול 13.90");
  });
  it("בלי קריאת ספרות הטקסט נשאר כמו שהוא", () => {
    expect(mergeDigitPass("במבה 4.90", "")).toBe("במבה 4.90");
  });
});

import { readFileSync } from "node:fs";
import { barcodeVariants, linesFromPasses, validBarcode } from "../lib/receipt-parse";

describe("ספרת ביקורת של ברקוד", () => {
  it("ברקודים אמיתיים תקינים; מספר טלפון ומספר חשבונית לא", () => {
    for (const code of ["7290000042411", "8006540968499", "835811007760", "7290020396839"]) expect(validBarcode(code)).toBe(true);
    for (const code of ["7290020396899", "0100000000017", "5550101", "abc"]) expect(validBarcode(code)).toBe(false);
  });
  it("תיקון ספרה אחת שנקראה לא נכון מחזיר גם את הברקוד האמיתי", () => {
    expect(barcodeVariants("7290020396899")).toContain("7290020396839");
    expect(barcodeVariants("7290011725196")).toContain("7290011725136");
    expect(barcodeVariants("7290020396899").every(validBarcode)).toBe(true);
  });
});

describe("צילום אמיתי של חשבונית (פלט OCR שמור)", () => {
  const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  const lines = linesFromPasses(fixture("receipt-photo.hebrew.txt"), fixture("receipt-photo.digits.txt"))!;
  const codes = lines.map((l) => l.barcode);

  it("כל 14 הברקודים שבחשבונית נמצאים, 12 מהם בדיוק ושניים בהפרש של ספרה אחת", () => {
    const printed = [
      "8006540968499", "7290020396839", "7290117387351", "7290107971720", "7297070015581", "7290011725136", "7290116932033",
      "7290105362339", "7290018886991", "8700216236751", "7290017088402", "7290101868958", "7290112001641", "835811007760",
    ];
    const long = codes.filter((c) => c!.length >= 12) as string[];
    expect(long).toHaveLength(14);
    expect(printed.filter((code) => long.includes(code))).toHaveLength(12);
    for (const code of printed) expect(long.some((c) => c === code || barcodeVariants(c).includes(code))).toBe(true);
  });
  it("מספרי הטלפון, החשבונית וההזמנה שבראש הדף אינם מוצרים", () => {
    for (const number of ["5550101", "5550102", "0100000000017", "50000001", "0000001"]) expect(codes).not.toContain(number);
  });
  it("ברקוד שמופיע פעמיים נספר פעם אחת, ושורות מבצע וסיכום לא נכנסות", () => {
    expect(codes.filter((c) => c === "7290105362339")).toHaveLength(1);
    expect(lines.length).toBeLessThanOrEqual(18);
  });
  it("בלי שני ברקודים תקינים חוזרים לפענוח הטקסט הרגיל", () => {
    expect(linesFromPasses("במבה 4.90", "4.90 nana")).toBeNull();
  });
});
