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
