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
    expect(variants[1]).toEqual({ query: "חלב תנובה ליטר", exact: true });
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
