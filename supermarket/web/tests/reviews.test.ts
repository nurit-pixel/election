import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({ pool: {} }));
vi.mock("../lib/session", () => ({ uid: async () => 1 }));

const { firstName } = await import("../lib/reviews");
const { navigationLinks } = await import("../lib/navigate");

describe("שם הכותב בחוות דעת", () => {
  it("רק השם הפרטי", () => {
    expect(firstName("נורית כהן")).toBe("נורית");
    expect(firstName("  גילי  ")).toBe("גילי");
  });
  it("בלי שם, או שם שהוא כתובת מייל: שם כללי", () => {
    expect(firstName(null)).toBe("משתמש/ת");
    expect(firstName("")).toBe("משתמש/ת");
    expect(firstName("someone@gmail.com")).toBe("משתמש/ת");
  });
});

describe("קישורי ניווט לסניף", () => {
  const store = { lat: 32.0853, lng: 34.7818, approximate: false, chainName: "שופרסל", address: "דיזנגוף 100", city: "תל אביב" };
  it("סניף שמוקם לפי הכתובת: ניווט לנקודה", () => {
    const links = navigationLinks(store)!;
    expect(links.waze).toBe("https://waze.com/ul?ll=32.085300,34.781800&navigate=yes");
    expect(links.google).toBe("https://www.google.com/maps/dir/?api=1&destination=32.085300,34.781800");
  });
  it("סניף שמוקם רק לפי העיר: ניווט לפי הכתובת הכתובה", () => {
    const links = navigationLinks({ ...store, approximate: true })!;
    expect(decodeURIComponent(links.waze)).toContain("שופרסל דיזנגוף 100, תל אביב");
  });
  it("בלי נקודה ובלי כתובת: אין ניווט", () => {
    expect(navigationLinks({ ...store, lat: null, lng: null, address: null, city: null })).toBeNull();
  });
});
