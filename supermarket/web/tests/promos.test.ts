import { describe, expect, it } from "vitest";
import { priceBasket, type BasketItem, type StorePrice } from "../lib/basket";
import { classify, promoCost, type Promo } from "../lib/promos";

const NOW = new Date("2026-11-12T12:00:00+02:00");
const FRESH = "2026-11-12T03:00:00+02:00";

let nextId = 1;
const promo = (fields: Partial<Promo>): Promo => ({
  id: nextId++,
  description: "מבצע",
  startAt: "2026-11-01T00:00:00+02:00",
  endAt: "2026-11-30T23:59:00+02:00",
  minQty: 1,
  maxQty: null,
  discountedPrice: null,
  nthN: null,
  nthRate: null,
  clubIds: [],
  clubName: null,
  minPurchase: null,
  restricted: false,
  ...fields,
});

const item = (id: number, productIds: number[], quantity = 1, isWeighted = false): BasketItem => ({
  id,
  name: `פריט ${id}`,
  quantity,
  isWeighted,
  productIds,
});

const store = (...entries: [number, number, Promo[]?][]) =>
  new Map<number, StorePrice>(
    entries.map(([productId, price, promos]) => [
      productId,
      { productId, productName: `מוצר ${productId}`, price, fileTime: FRESH, promos: promos ?? [] },
    ]),
  );

const line = (basket: ReturnType<typeof priceBasket>, index = 0) => {
  const l = basket.lines[index];
  if (!l.found) throw new Error("line not found");
  return l;
};

describe("סיווג מבצעים לפי השדות", () => {
  it("מחיר מוזל ליחידה", () => {
    expect(classify(promo({ discountedPrice: 12.9 }), 16.9, false)).toEqual({ kind: "unit_price", price: 12.9, minQty: 1 });
  });
  it("כמות במחיר קבוע: המחיר המוזל גבוה ממחיר יחידה", () => {
    expect(classify(promo({ minQty: 2, discountedPrice: 12 }), 7.9, false)).toEqual({ kind: "bundle", n: 2, price: 12 });
  });
  it("מחיר מוזל ליחידה מכמות מינימלית: המחיר המוזל נמוך ממחיר יחידה", () => {
    expect(classify(promo({ minQty: 3, discountedPrice: 5 }), 6.9, false)).toEqual({ kind: "unit_price", price: 5, minQty: 3 });
  });
  it("מבצע שאינו מוזיל אינו מסווג", () => {
    expect(classify(promo({ minQty: 2, discountedPrice: 20 }), 7.9, false)).toBeNull();
    expect(classify(promo({ discountedPrice: 19.9 }), 19.9, false)).toBeNull();
  });
});

describe("promoCost", () => {
  it("מחיר מוזל (RewardType 1 במפרט): כל היחידות במחיר המוזל", () => {
    expect(promoCost(16.9, 3, false, promo({ discountedPrice: 12.9 }))).toBeCloseTo(38.7);
  });

  it("2 ב-X: זוג במחיר קבוע והיחידה השלישית במחיר מלא", () => {
    const twoFor12 = promo({ minQty: 2, discountedPrice: 12 });
    expect(promoCost(7.9, 2, false, twoFor12)).toBeCloseTo(12);
    expect(promoCost(7.9, 3, false, twoFor12)).toBeCloseTo(19.9);
    expect(promoCost(7.9, 4, false, twoFor12)).toBeCloseTo(24);
  });

  it("MinQty: מתחת לכמות המינימלית המבצע לא חל", () => {
    expect(promoCost(7.9, 1, false, promo({ minQty: 2, discountedPrice: 12 }))).toBeNull();
    expect(promoCost(6.9, 2, false, promo({ minQty: 3, discountedPrice: 5 }))).toBeNull();
    expect(promoCost(6.9, 3, false, promo({ minQty: 3, discountedPrice: 5 }))).toBeCloseTo(15);
  });

  it("MaxQty: מעבר לכמות המרבית משלמים מחיר מלא", () => {
    expect(promoCost(10, 5, false, promo({ discountedPrice: 6, maxQty: 2 }))).toBeCloseTo(42);
    // 2 ב-12 עם מקסימום 2: רק חבילה אחת
    expect(promoCost(7.9, 4, false, promo({ minQty: 2, discountedPrice: 12, maxQty: 2 }))).toBeCloseTo(27.8);
  });

  it("הנחה על הפריט ה-N: 1+1 והשני ב-50%", () => {
    const onePlusOne = promo({ nthN: 2, nthRate: 100 });
    expect(promoCost(28.9, 2, false, onePlusOne)).toBeCloseTo(28.9);
    expect(promoCost(28.9, 3, false, onePlusOne)).toBeCloseTo(57.8);
    expect(promoCost(28.9, 1, false, onePlusOne)).toBeNull();
    expect(promoCost(19.9, 2, false, promo({ nthN: 2, nthRate: 50 }))).toBeCloseTo(29.85);
  });

  it("מוצר שקיל: מחיר מוזל לק״ג, והכמות בק״ג", () => {
    expect(promoCost(14.9, 1.5, true, promo({ minQty: 0.01, discountedPrice: 10.9, maxQty: 9 }))).toBeCloseTo(16.35);
  });
});

describe("מבצעים בסל", () => {
  it("מבצע 2 ב-X מוחל על השורה ומחושב כחיסכון", () => {
    const basket = priceBasket([item(1, [10], 2)], store([10, 7.9, [promo({ description: "2 ב-12", minQty: 2, discountedPrice: 12 })]]), NOW);
    expect(basket.total).toBe(12);
    expect(basket.regularTotal).toBe(15.8);
    expect(basket.savings).toBe(3.8);
    expect(line(basket).promo?.description).toBe("2 ב-12");
  });

  it("תאריכי תוקף: מבצע שפג או שטרם התחיל לא חל", () => {
    const expired = promo({ discountedPrice: 5, endAt: "2026-11-11T23:59:00+02:00" });
    const future = promo({ discountedPrice: 5, startAt: "2026-11-13T00:00:00+02:00" });
    const basket = priceBasket([item(1, [10])], store([10, 8, [expired, future]]), NOW);
    expect(basket.total).toBe(8);
    expect(line(basket).promo).toBeNull();
  });

  it("מבצע מועדון שלא סומן: לא חל, מוצג כחיסכון אפשרי לחברי מועדון", () => {
    const club = promo({ description: "מועדון 35.90", discountedPrice: 35.9, clubIds: [1], clubName: "המועדון החדש" });
    const basket = priceBasket([item(1, [10])], store([10, 46.9, [club]]), NOW);
    expect(basket.total).toBe(46.9);
    expect(basket.savings).toBe(0);
    expect(line(basket).promo).toBeNull();
    expect(line(basket).clubOffer).toMatchObject({ description: "מועדון 35.90", clubName: "המועדון החדש", saving: 11 });
    expect(basket.clubSavings).toBe(11);
  });

  it("מבצע מועדון שסומן בהגדרות: חל", () => {
    const club = promo({ discountedPrice: 35.9, clubIds: [1], clubName: "המועדון החדש" });
    const basket = priceBasket([item(1, [10])], store([10, 46.9, [club]]), NOW, { memberClubIds: [1] });
    expect(basket.total).toBe(35.9);
    expect(line(basket).promo?.clubName).toBe("המועדון החדש");
    expect(line(basket).clubOffer).toBeNull();
    expect(basket.clubSavings).toBe(0);
  });

  it("חבר במועדון אחר לא מקבל את המבצע", () => {
    const club = promo({ discountedPrice: 35.9, clubIds: [2], clubName: "אשראי" });
    expect(priceBasket([item(1, [10])], store([10, 46.9, [club]]), NOW, { memberClubIds: [1] }).total).toBe(46.9);
  });

  it("MinPurchaseAmnt: לא מחושב, רק מוצג כהערה", () => {
    const coupon = promo({ description: "30 ש״ח הנחה", discountedPrice: 1, minPurchase: 199 });
    const basket = priceBasket([item(1, [10])], store([10, 19.9, [coupon]]), NOW);
    expect(basket.total).toBe(19.9);
    expect(line(basket).promo).toBeNull();
    expect(line(basket).notes).toEqual(["30 ש״ח הנחה (בקנייה מעל ₪199)"]);
  });

  it("מבין כמה מבצעים נבחר הזול, בלי לצבור מבצעים", () => {
    const basket = priceBasket(
      [item(1, [10], 2)],
      store([10, 10, [promo({ description: "9", discountedPrice: 9 }), promo({ description: "2 ב-15", minQty: 2, discountedPrice: 15 })]]),
      NOW,
    );
    expect(basket.total).toBe(15);
    expect(line(basket).promo?.description).toBe("2 ב-15");
  });

  it("חלופות: נבחרת החלופה הזולה אחרי מבצעים", () => {
    const basket = priceBasket(
      [item(1, [10, 11], 2)],
      store([10, 6], [11, 7.9, [promo({ minQty: 2, discountedPrice: 10 })]]),
      NOW,
    );
    expect(line(basket).productId).toBe(11);
    expect(basket.total).toBe(10);
  });

  it("מוצר שקיל במבצע: 1.5 ק״ג במחיר מוזל לק״ג", () => {
    const basket = priceBasket([item(1, [10], 1.5, true)], store([10, 14.9, [promo({ minQty: 0.01, discountedPrice: 10.9 })]]), NOW);
    expect(basket.total).toBe(16.35);
    expect(basket.regularTotal).toBe(22.35);
  });

  it("פריט חסר לצד מבצע: הסל חלקי והחיסכון מחושב רק על מה שנמצא", () => {
    const basket = priceBasket([item(1, [10], 2), item(2, [20])], store([10, 7.9, [promo({ minQty: 2, discountedPrice: 12 })]]), NOW);
    expect(basket.complete).toBe(false);
    expect(basket.foundCount).toBe(1);
    expect(basket.total).toBe(12);
  });

  it("מבצע N ב-X על כמה מוצרים: כמויות של שורות שונות מצטרפות", () => {
    const yogurts = promo({ description: "4 ב-20", minQty: 4, discountedPrice: 20 });
    const basket = priceBasket(
      [item(1, [10], 2), item(2, [11], 2)],
      store([10, 6.9, [yogurts]], [11, 6.9, [yogurts]]),
      NOW,
    );
    expect(basket.regularTotal).toBe(27.6);
    expect(basket.total).toBe(20);
    expect(line(basket, 0).promo?.description).toBe("4 ב-20");
    expect(line(basket, 1).total).toBe(10);
  });

  it("צירוף כמויות: היחידה העודפת (היקרה) משולמת במחיר מלא", () => {
    const deal = promo({ minQty: 2, discountedPrice: 10 });
    const basket = priceBasket(
      [item(1, [10], 1), item(2, [11], 1), item(3, [12], 1)],
      store([10, 6, [deal]], [11, 7, [deal]], [12, 8, [deal]]),
      NOW,
    );
    // חבילה אחת (6 + 7, הזולים) ב-10, והיחידה היקרה שנותרה ב-8
    expect(basket.total).toBe(18);
    expect(basket.regularTotal).toBe(21);
  });

  it("צירוף כמויות לא מוחל כשהחישוב לכל שורה בנפרד זול יותר", () => {
    const deal = promo({ minQty: 2, discountedPrice: 10 });
    const basket = priceBasket(
      [item(1, [10], 1), item(2, [11], 2)],
      store([10, 6, [deal]], [11, 8, [deal]]),
      NOW,
    );
    // שורה 2 לבדה: 2 ב-10; שורה 1 במחיר מלא
    expect(basket.total).toBe(16);
  });
});
