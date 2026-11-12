import { describe, expect, it } from "vitest";
import type { BasketItem, StorePrice } from "../lib/basket";
import type { Promo } from "../lib/promos";
import { allSplits, nearestStores, splitBetween, worthwhileSplits, type SplitCandidate } from "../lib/split";

const NOW = new Date("2026-11-12T12:00:00+02:00");
const FRESH = "2026-11-12T03:00:00+02:00";

const item = (id: number, quantity = 1): BasketItem => ({
  id,
  name: `פריט ${id}`,
  quantity,
  isWeighted: false,
  productIds: [id],
});

const candidate = (
  name: string,
  distanceKm: number | null,
  entries: [number, number, Promo[]?][],
): SplitCandidate<string> => ({
  store: name,
  distanceKm,
  prices: new Map<number, StorePrice>(
    entries.map(([productId, price, promos]) => [
      productId,
      { productId, productName: `מוצר ${productId}`, price, fileTime: FRESH, promos: promos ?? [] },
    ]),
  ),
});

const items = [item(1), item(2), item(3), item(4)];

describe("splitBetween", () => {
  it("כל פריט הולך לסניף שבו הוא זול יותר", () => {
    const a = candidate("א", 1, [[1, 10], [2, 30], [3, 5], [4, 40]]);
    const b = candidate("ב", 2, [[1, 12], [2, 20], [3, 6], [4, 25]]);
    const pair = splitBetween(items, a, b, NOW)!;
    expect(pair.basketA.lines.map((l) => l.itemId)).toEqual([1, 3]);
    expect(pair.basketB.lines.map((l) => l.itemId)).toEqual([2, 4]);
    expect(pair.total).toBe(60); // 10 + 5 + 20 + 25
    expect(pair.complete).toBe(true);
  });

  it("פריט שקיים רק בסניף אחד הולך אליו; פריט שאין באף אחד נרשם כחסר", () => {
    const a = candidate("א", 1, [[1, 10], [2, 30]]);
    const b = candidate("ב", 2, [[2, 20], [3, 6]]);
    const pair = splitBetween(items, a, b, NOW)!;
    expect(pair.basketA.lines.map((l) => l.itemId)).toEqual([1]);
    expect(pair.basketB.lines.map((l) => l.itemId)).toEqual([2, 3]);
    expect(pair.missing.map((i) => i.id)).toEqual([4]);
    expect(pair.complete).toBe(false);
    expect(pair.foundCount).toBe(3);
  });

  it("אם הכול זול יותר באותו סניף – אין פיצול", () => {
    const a = candidate("א", 1, [[1, 1], [2, 1], [3, 1], [4, 1]]);
    const b = candidate("ב", 2, [[1, 2], [2, 2], [3, 2], [4, 2]]);
    expect(splitBetween(items, a, b, NOW)).toBeNull();
  });

  it("מבצעים נלקחים בחשבון בהשוואה בין הסניפים", () => {
    const twoFor10: Promo = {
      id: 1, description: "2 ב-10", startAt: null, endAt: null, minQty: 2, maxQty: null,
      discountedPrice: 10, nthN: null, nthRate: null, clubIds: [], clubName: null, minPurchase: null, restricted: false,
    };
    const a = candidate("א", 1, [[1, 8, [twoFor10]], [2, 30]]);
    const b = candidate("ב", 2, [[1, 6], [2, 20]]);
    // 2 יחידות של פריט 1: בסניף א' 10 (מבצע), בסניף ב' 12
    const pair = splitBetween([item(1, 2), item(2)], a, b, NOW)!;
    expect(pair.basketA.total).toBe(10);
    expect(pair.basketB.total).toBe(20);
  });
});

describe("allSplits", () => {
  it("נבדקים רק 20 הסניפים הקרובים", () => {
    const stores = Array.from({ length: 30 }, (_, i) => candidate(`s${i}`, i, [[1, 10]]));
    expect(nearestStores(stores).map((s) => s.store)).toEqual(Array.from({ length: 20 }, (_, i) => `s${i}`));
    // סניף רחוק (מספר 25) עם מחיר מצוין לא נכנס לזוגות
    stores[25] = candidate("רחוק", 25, [[1, 1], [2, 1], [3, 1], [4, 1]]);
    stores[0] = candidate("קרוב", 0, [[1, 5], [2, 50], [3, 5], [4, 50]]);
    stores[1] = candidate("קרוב2", 1, [[1, 50], [2, 5], [3, 50], [4, 5]]);
    const pairs = allSplits(items, stores, NOW);
    expect(pairs.some((p) => p.a === "רחוק" || p.b === "רחוק")).toBe(false);
    expect(pairs[0]).toMatchObject({ a: "קרוב", b: "קרוב2", total: 20 });
  });

  it("סניף בלי מרחק ידוע ממוין אחרון", () => {
    const stores = [candidate("לא ידוע", null, [[1, 1]]), candidate("קרוב", 0.5, [[1, 1]])];
    expect(nearestStores(stores).map((s) => s.store)).toEqual(["קרוב", "לא ידוע"]);
  });
});

describe("worthwhileSplits", () => {
  const a = candidate("א", 1, [[1, 10], [2, 30], [3, 5], [4, 40]]);
  const b = candidate("ב", 2, [[1, 12], [2, 20], [3, 6], [4, 25]]);
  const pairs = allSplits(items, [a, b], NOW); // פיצול ב-60

  it("מוצג רק כשהחיסכון עובר את הסף (ברירת מחדל 20 ש״ח)", () => {
    // הסל הזול בסניף אחד: סניף ב' ב-63 -> חיסכון 3 בלבד
    expect(worthwhileSplits(pairs, { total: 63, foundCount: 4 })).toEqual([]);
    // מול סל של 85 בסניף אחד -> חיסכון 25
    const offers = worthwhileSplits(pairs, { total: 85, foundCount: 4 });
    expect(offers).toHaveLength(1);
    expect(offers[0].saving).toBe(25);
  });

  it("סף מותאם אישית", () => {
    expect(worthwhileSplits(pairs, { total: 63, foundCount: 4 }, 2)).toHaveLength(1);
    expect(worthwhileSplits(pairs, { total: 85, foundCount: 4 }, 30)).toEqual([]);
  });

  it("חיסכון בדיוק בגובה הסף מוצג", () => {
    expect(worthwhileSplits(pairs, { total: 80, foundCount: 4 })).toHaveLength(1);
  });

  it("פיצול שמשלים פריטים שאין באף סניף יחיד מוצג גם בלי חיסכון", () => {
    const offers = worthwhileSplits(pairs, { total: 40, foundCount: 3 });
    expect(offers).toHaveLength(1);
    expect(offers[0].saving).toBeNull();
  });

  it("פיצול חלקי לא מוצג מול סל מלא בסניף אחד", () => {
    const partial = allSplits(items, [candidate("א", 1, [[1, 1], [2, 9]]), candidate("ב", 2, [[1, 9], [2, 1]])], NOW);
    expect(worthwhileSplits(partial, { total: 100, foundCount: 4 })).toEqual([]);
  });
});
