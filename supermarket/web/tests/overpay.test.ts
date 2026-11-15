import { describe, expect, it } from "vitest";
import { overpay, type StoreOffer } from "../lib/overpay-calc";

const store = (storePk: number, prices: Record<number, number>): StoreOffer => ({
  storePk,
  label: `סניף ${storePk}`,
  prices: new Map(Object.entries(prices).map(([id, price]) => [Number(id), price])),
});

describe("פראיירמטר לחשבונית", () => {
  const paid = [
    { productId: 1, paid: 10 },
    { productId: 2, paid: 20 },
    { productId: 3, paid: 5 },
  ];

  it("משווה מול הסניף שמוכר הכי הרבה מהמוצרים", () => {
    const result = overpay(paid, [store(1, { 1: 8, 2: 15 }), store(2, { 1: 9, 2: 18, 3: 4 })])!;
    expect(result.store.storePk).toBe(2);
    expect(result).toMatchObject({ count: 3, paid: 35, elsewhere: 31, difference: 4 });
  });
  it("בשוויון בכיסוי, הסניף הזול", () => {
    const result = overpay(paid, [store(1, { 1: 9, 2: 18, 3: 4 }), store(2, { 1: 7, 2: 15, 3: 4 })])!;
    expect(result.store.storePk).toBe(2);
    expect(result.difference).toBe(9);
  });
  it("שילמת פחות: הפרש שלילי", () => {
    expect(overpay(paid, [store(1, { 1: 12, 2: 25, 3: 6 })])!.difference).toBe(-8);
  });
  it("פחות משני מוצרים להשוואה: אין תוצאה", () => {
    expect(overpay(paid, [store(1, { 1: 8 })])).toBeNull();
    expect(overpay([{ productId: 1, paid: 10 }], [store(1, { 1: 8, 2: 1 })])).toBeNull();
  });
  it("מחיר ששולם לא תקין לא נספר", () => {
    expect(overpay([{ productId: 1, paid: 0 }, { productId: 2, paid: NaN }, { productId: 3, paid: 5 }], [store(1, { 1: 1, 2: 1, 3: 1 })])).toBeNull();
  });
});
