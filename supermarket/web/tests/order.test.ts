import { describe, expect, it } from "vitest";
import { cheapestFirst } from "../lib/order";
import { QUIPS, quip, type QuipPlace } from "../lib/quips";

const product = (name: string, ...prices: number[]) => ({ name, prices: prices.map((price) => ({ price })) });

describe("מיון תוצאות חיפוש", () => {
  it("ההצעה הזולה ביותר למעלה, לפי המחיר הנמוך של כל מוצר", () => {
    const sorted = cheapestFirst([product("ב", 10.2, 14.9), product("א", 4.9, 9.9), product("ג", 5.5)]);
    expect(sorted.map((p) => p.name)).toEqual(["א", "ג", "ב"]);
  });
  it("מוצר בלי מחיר בסביבה יורד לסוף, ובשוויון נשמר הסדר המקורי", () => {
    const sorted = cheapestFirst([product("בלי מחיר"), product("ראשון", 5), product("שני", 5)]);
    expect(sorted.map((p) => p.name)).toEqual(["ראשון", "שני", "בלי מחיר"]);
  });
  it("לא משנה את המערך המקורי", () => {
    const original = [product("ב", 9), product("א", 3)];
    cheapestFirst(original);
    expect(original[0].name).toBe("ב");
  });
});

describe("הערות ציניות", () => {
  it("לכל מקום יש לפחות הערה אחת, קצרה מספיק לשורה או שתיים", () => {
    for (const place of Object.keys(QUIPS) as QuipPlace[]) {
      expect(QUIPS[place].length).toBeGreaterThan(0);
      for (const text of QUIPS[place]) expect(text.length).toBeLessThanOrEqual(90);
    }
  });
  it("בחירה לפי אינדקס עוברת על כל ההערות במחזוריות", () => {
    expect(quip("compare", 0)).toBe(QUIPS.compare[0]);
    expect(quip("compare", QUIPS.compare.length)).toBe(QUIPS.compare[0]);
    expect(QUIPS.login).toContain(quip("login"));
  });
});

import { pageId } from "../lib/ids";

describe("מזהה מתוך כתובת הדף", () => {
  it("מספר שלם חיובי בטווח", () => {
    expect(pageId("763")).toBe(763);
    expect(pageId("2147483647")).toBe(2147483647);
  });
  it("ערך לא תקין או מחוץ לטווח: דף לא נמצא במקום שגיאת שרת", () => {
    for (const bad of ["99999999999999", "2147483648", "0", "-5", "abc", "12.5", ""]) expect(pageId(bad)).toBeNull();
  });
});
