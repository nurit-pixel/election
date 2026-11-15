import { describe, expect, it } from "vitest";
import { isRelated, isSimilar, relatedProducts, suggestAlternative, type ProductOffer } from "../lib/alternatives-calc";

const offer = (id: number, name: string, minPrice: number, quantity: number | null = 250, extra: Partial<ProductOffer> = {}): ProductOffer => ({
  id,
  name,
  isWeighted: false,
  quantity,
  unit: "100 גרם",
  minPrice,
  ...extra,
});

describe("חלופה זולה", () => {
  const cottage = offer(1, "קוטג 5% 250 גרם בעלז", 6.1);

  it("מציעה מוצר דומה, באותו גודל ואחוז שומן, שזול לפחות ב-15%", () => {
    cottage.manufacturer = "מחלבת בעלז";
    const result = suggestAlternative(cottage, [offer(2, "קוטג 5% 250ג טרה", 4.9), offer(3, "קוטג 5% 250ג שטראוס", 5.9)])!;
    expect(result.product.id).toBe(2);
    expect(result.saving).toBe(1.2);
    expect(result.savingPct).toBe(20);
  });
  it("לא מציעה אחוז שומן אחר, גודל אחר או מוצר מסוג אחר", () => {
    expect(isSimilar(offer(2, "קוטג 9% 250ג", 4), cottage)).toBe(false);
    expect(isSimilar(offer(3, "קוטג 5% 500ג", 8, 500), cottage)).toBe(false);
    expect(isSimilar(offer(4, "גבינה 5% 250ג", 3), cottage)).toBe(false);
    expect(isSimilar(offer(5, "קוטג 5% 250ג", 3, 250, { isWeighted: true }), cottage)).toBe(false);
  });
  it("חיסכון קטן מדי: אין הצעה", () => {
    expect(suggestAlternative(cottage, [offer(2, "קוטג 5% 250ג טרה", 5.5)])).toBeNull();
  });
  it("גודל קרוב: המחיר מושווה לאותו גודל", () => {
    // 225 גרם ב-4.95 = 5.50 ל-250 גרם: חיסכון של 10% בלבד
    expect(suggestAlternative(cottage, [offer(2, "קוטג 5% 225ג", 4.95, 225)])).toBeNull();
  });
  it("לא מציעה את המוצר עצמו", () => {
    expect(suggestAlternative(cottage, [cottage])).toBeNull();
  });
});

describe("גרסאות שונות של אותו מוצר אינן חלופה", () => {
  it("קולה זירו מול קולה רגילה", () => {
    expect(isSimilar(offer(2, "קוקה קולה שישייה 1.5", 30, 9000), offer(1, "קוקה קולה זירו 6*1.5 ל", 47, 9000))).toBe(false);
  });
  it("ביצים L אומגה מול ביצים M", () => {
    expect(isSimilar(offer(2, "ביצים 12 יח בינוני M", 13, null), offer(1, "ביצים אומגה3 12יחידות L", 25, null))).toBe(false);
    expect(isSimilar(offer(2, "ביצים 12 יח L", 13, 12), offer(1, "ביצים 12 יחידות L", 18, 12))).toBe(true);
    expect(isSimilar(offer(2, "פחית קולה זירו 330 מ", 3.1, 330), offer(1, "פחית קוקה קולה זירו330מל", 4.2, 330, { manufacturer: "קוקה קולה" }))).toBe(true);
  });
  it("אותו מוצר ממותג אחר עדיין חלופה", () => {
    expect(isSimilar(offer(2, "קוטג 5% 250ג טרה", 4.9), offer(1, "קוטג 5% 250 גרם בעלז", 6.1, 250, { manufacturer: "בעלז" }))).toBe(true);
  });
  it("טעם או סוג אחר אינו חלופה", () => {
    expect(isSimilar(offer(2, "קליק קורנפלקס 75 גרם", 6.9, 75), offer(1, "קליק כריות 65 גרם", 7.3, 65, { manufacturer: "עלית" }))).toBe(false);
    expect(isSimilar(offer(2, "ביסקוויט חיות 180 גרם", 5.9, 180), offer(1, "ביסקוויט נוטלה 166 גרם", 16.9, 166))).toBe(false);
    expect(isSimilar(offer(2, "חטיף קיט צאנקי לבן 40 גרם", 3.3, 40), offer(1, "חטיף דובונים 40 גרם", 3.9, 40))).toBe(false);
  });
});

describe("מילים מחוברות בסימנים", () => {
  it("פריכיות דקות+קינואה אינן פריכיות כוסמת", () => {
    expect(isSimilar(offer(2, "פריכיות כוסמת 100 גרם", 3.9, 100), offer(1, "פריכיות דקות+קינואה120גר", 9.9, 120, { manufacturer: "פרח" }))).toBe(false);
  });
});

describe("מוצרים דומים ומותגים אחרים", () => {
  const cottage = offer(1, "קוטג 5% 250 גרם תנובה", 6, 250, { manufacturer: "תנובה" });

  it("כוללת מותגים אחרים וגדלים אחרים, מהזול ליקר לפי מחיר לגודל המקורי", () => {
    const list = relatedProducts(
      [cottage],
      [offer(2, "קוטג 5% 250ג טרה", 5.5), offer(3, "קוטג 5% 500ג שטראוס", 9, 500), offer(4, "קוטג 5% 250ג בעלז", 6.4)],
      new Set([1]),
    );
    expect(list.map((r) => r.product.id)).toEqual([3, 2, 4]);
    expect(list[0].comparablePrice).toBe(4.5);
    expect(list[0].resized).toBe(true);
    expect(list[1].resized).toBe(false);
  });
  it("לא כוללת אחוז שומן אחר, גרסה אחרת, גודל רחוק או מוצרים שכבר בפריט", () => {
    expect(isRelated(offer(2, "קוטג 9% 250ג", 4), cottage)).toBe(false);
    expect(isRelated(offer(3, "קוטג 5% 1000ג", 15, 1000), cottage)).toBe(false);
    expect(isRelated(offer(4, "קוטג 5% לייט 250ג", 5), cottage)).toBe(false);
    expect(isRelated(offer(6, "קוטג 5% עם זיתים 250 גר", 5), cottage)).toBe(false);
    const eggs = offer(10, "ביצים אומגה3 12יחידות L", 20, null);
    expect(isRelated(offer(11, "ביצים אומגה L שופרסל 6יח", 9, null), eggs)).toBe(false);
    expect(isRelated(offer(12, "ביצים L אומגה 3 12 יח", 18, null), eggs)).toBe(true);
    const cola = offer(13, "קוקה קולה זירו 6*1.5 ל", 40, null);
    expect(isRelated(offer(14, "קוקה קולה זירו משקה", 8, null), cola)).toBe(false);
    expect(relatedProducts([cottage], [offer(5, "קוטג 5% 250ג טרה", 5)], new Set([1, 5]))).toEqual([]);
  });
  it("מותג שמופיע רק בשם (ולא בשדה היצרן) לא מונע התאמה", () => {
    const belz = offer(7, "קוטג 5% 250 גרם בעלז", 6, 250, { manufacturer: "מחלבת אלון תבור" });
    expect(isRelated(offer(8, "קוטג 5% שומן 250ג טרה", 5, 250, { manufacturer: "---" }), belz)).toBe(true);
    expect(isRelated(offer(9, "קוטג 5% 250ג שטראוס", 5, 250, { manufacturer: "שטראוס בריאות" }), belz)).toBe(true);
  });
});
