import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({ pool: {} }));
vi.mock("../lib/session", () => ({ uid: async () => 1 }));
const { basketChange } = await import("../lib/basket-history");

describe("שינוי במחיר הסל", () => {
  it("מהנקודה הראשונה לאחרונה", () => {
    expect(basketChange([{ day: "2026-10-01", price: 100 }, { day: "2026-10-15", price: 95 }, { day: "2026-11-01", price: 112.5 }])).toEqual({
      amount: 12.5,
      pct: 12.5,
      since: "2026-10-01",
    });
  });
  it("נקודה אחת: אין שינוי לחשב", () => {
    expect(basketChange([{ day: "2026-10-01", price: 100 }])).toBeNull();
  });
});

import { basketSeries } from "../lib/basket-history-calc";

describe("מדד הסל מתוך מחירים יומיים", () => {
  const q = new Map([
    [1, 2],
    [2, 1],
  ]);
  it("סכום לכל יום, כפול הכמות", () => {
    const { points, itemsCounted } = basketSeries(
      [
        { day: "2026-11-01", itemId: 1, price: 5 },
        { day: "2026-11-01", itemId: 2, price: 10 },
        { day: "2026-11-02", itemId: 1, price: 6 },
        { day: "2026-11-02", itemId: 2, price: 10 },
      ],
      q,
    );
    expect(itemsCounted).toBe(2);
    expect(points).toEqual([
      { day: "2026-11-01", price: 20 },
      { day: "2026-11-02", price: 22 },
    ]);
  });
  it("יום בלי מחיר לפריט: המחיר האחרון נשאר בתוקף עד שבוע", () => {
    const { points } = basketSeries(
      [
        { day: "2026-11-01", itemId: 1, price: 5 },
        { day: "2026-11-01", itemId: 2, price: 10 },
        { day: "2026-11-03", itemId: 1, price: 4 },
        { day: "2026-11-12", itemId: 1, price: 4 },
        { day: "2026-11-12", itemId: 2, price: 9 },
      ],
      q,
    );
    // 3.11: פריט 2 עדיין 10 מה-1.11. ה-12.11 מחוץ לשבוע אבל שם יש מחיר חדש
    expect(points).toEqual([
      { day: "2026-11-01", price: 20 },
      { day: "2026-11-03", price: 18 },
      { day: "2026-11-12", price: 17 },
    ]);
  });
  it("פריט בלי מחיר ביום האחרון לא נכלל", () => {
    const { points, itemsCounted } = basketSeries(
      [
        { day: "2026-10-01", itemId: 2, price: 10 },
        { day: "2026-11-01", itemId: 1, price: 5 },
      ],
      q,
    );
    expect(itemsCounted).toBe(1);
    expect(points).toEqual([{ day: "2026-11-01", price: 10 }]);
  });
});
