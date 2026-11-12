import { describe, expect, it } from "vitest";
import { priceBasket, rankStores, type BasketItem, type StorePrice } from "../lib/basket";

const NOW = new Date("2026-11-12T12:00:00+02:00");
const FRESH = "2026-11-12T03:00:00+02:00";
const OLD = "2026-11-10T03:00:00+02:00"; // 57 שעות

const prices = (...entries: [number, number, string?][]) =>
  new Map<number, StorePrice>(
    entries.map(([productId, price, fileTime]) => [
      productId,
      { productId, productName: `מוצר ${productId}`, price, fileTime: fileTime ?? FRESH },
    ]),
  );

const item = (id: number, productIds: number[], quantity = 1, isWeighted = false): BasketItem => ({
  id,
  name: `פריט ${id}`,
  quantity,
  isWeighted,
  productIds,
});

describe("priceBasket", () => {
  it("מכפיל מחיר בכמות ומסכם", () => {
    const basket = priceBasket([item(1, [10], 2), item(2, [20], 3)], prices([10, 5.9], [20, 4.5]), NOW);
    expect(basket.total).toBe(25.3);
    expect(basket.complete).toBe(true);
    expect(basket.foundCount).toBe(2);
  });

  it("מוצר שקיל: הכמות בק״ג והמחיר לק״ג", () => {
    const basket = priceBasket([item(1, [10], 1.5, true)], prices([10, 12.9]), NOW);
    const line = basket.lines[0];
    expect(line.found && line.unitPrice).toBe(12.9);
    expect(basket.total).toBe(19.35);
  });

  it("קבוצת חלופות: נלקחת החלופה הזולה שקיימת בסניף", () => {
    const basket = priceBasket([item(1, [10, 11, 12], 2)], prices([10, 8], [11, 6.5]), NOW);
    const line = basket.lines[0];
    expect(line.found && line.productId).toBe(11);
    expect(basket.total).toBe(13);
  });

  it("פריט חסר: לא נכלל בסכום והסל אינו מלא", () => {
    const basket = priceBasket([item(1, [10]), item(2, [20])], prices([10, 7]), NOW);
    expect(basket.lines[1].found).toBe(false);
    expect(basket.total).toBe(7);
    expect(basket.foundCount).toBe(1);
    expect(basket.itemCount).toBe(2);
    expect(basket.complete).toBe(false);
  });

  it("מחיר ישן מ-36 שעות מסומן", () => {
    const basket = priceBasket([item(1, [10]), item(2, [20])], prices([10, 7, OLD], [20, 3]), NOW);
    expect(basket.lines[0].found && basket.lines[0].stale).toBe(true);
    expect(basket.lines[1].found && basket.lines[1].stale).toBe(false);
    expect(basket.stale).toBe(true);
  });

  it("סכומים מעוגלים לאגורות", () => {
    const basket = priceBasket([item(1, [10], 0.35, true), item(2, [20], 3)], prices([10, 9.9], [20, 0.1]), NOW);
    expect(basket.lines[0].found && basket.lines[0].total).toBe(3.47);
    expect(basket.total).toBe(3.77);
  });

  it("רשימה ריקה אינה סל מלא", () => {
    expect(priceBasket([], prices(), NOW).complete).toBe(false);
  });
});

describe("rankStores", () => {
  const items = [item(1, [10]), item(2, [20]), item(3, [30])];
  const store = (name: string, p: Map<number, StorePrice>, isPharm = false) => ({
    name,
    isPharm,
    basket: priceBasket(items, p, NOW),
  });

  it("סל מלא מדורג לפי מחיר", () => {
    const ranked = rankStores([
      store("יקר", prices([10, 5], [20, 5], [30, 5])),
      store("זול", prices([10, 4], [20, 4], [30, 4])),
    ]);
    expect(ranked.map((s) => s.name)).toEqual(["זול", "יקר"]);
  });

  it("סניף עם פריט חסר לא מדורג מעל סניף עם סל מלא, גם אם הוא זול יותר", () => {
    const ranked = rankStores([
      store("חלקי וזול", prices([10, 1], [20, 1])),
      store("מלא", prices([10, 9], [20, 9], [30, 9])),
    ]);
    expect(ranked.map((s) => s.name)).toEqual(["מלא", "חלקי וזול"]);
  });

  it("בין סלים חלקיים: יותר פריטים קודם, ואז לפי מחיר", () => {
    const ranked = rankStores([
      store("אחד", prices([10, 1])),
      store("שניים יקר", prices([10, 9], [20, 9])),
      store("שניים זול", prices([10, 2], [20, 2])),
    ]);
    expect(ranked.map((s) => s.name)).toEqual(["שניים זול", "שניים יקר", "אחד"]);
  });

  it("רשתות פארם וסניפים בלי אף פריט אינם בדירוג", () => {
    const ranked = rankStores([
      store("פארם", prices([10, 1], [20, 1], [30, 1]), true),
      store("ריק", prices()),
      store("סופר", prices([10, 5], [20, 5], [30, 5])),
    ]);
    expect(ranked.map((s) => s.name)).toEqual(["סופר"]);
  });
});
