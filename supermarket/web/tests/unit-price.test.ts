import { describe, expect, it } from "vitest";
import { packSize, unitPrice } from "../lib/unit-price";

describe("מחיר ליחידת מידה", () => {
  it("לק״ג ולליטר", () => {
    expect(unitPrice(6, 250, "גרם")).toEqual({ value: 24, label: "לק״ג" });
    expect(unitPrice(7.9, 1, "ליטר")).toEqual({ value: 7.9, label: "לליטר" });
    expect(unitPrice(12, 1.5, "קילוגרם")).toEqual({ value: 8, label: "לק״ג" });
    expect(unitPrice(5, 330, "מיליליטר")).toEqual({ value: 15.15, label: "לליטר" });
  });
  it("אריזה קטנה: ל-100 גרם", () => {
    expect(unitPrice(4.5, 60, "גרם")).toEqual({ value: 7.5, label: "ל-100 גרם" });
  });
  it("מארז של כמה יחידות: ליחידה", () => {
    expect(unitPrice(24, 12, "יחידות")).toEqual({ value: 2, label: "ליחידה" });
    expect(unitPrice(3, 1, "יחידה")).toBeNull();
    // ביצים: הרשת רושמת "1 יחידות", והמספר בשם
    expect(unitPrice(18, 1, "יחידות", false, "ביצים L 12 יח")).toEqual({ value: 1.5, label: "ליחידה" });
  });
  it("שקיל, יחידה לא ידועה או כמות חסרה: אין", () => {
    expect(unitPrice(10, 1, "קילוגרם", true)).toBeNull();
    expect(unitPrice(10, 5, "Unknown")).toBeNull();
    expect(unitPrice(10, null, "גרם")).toBeNull();
    expect(packSize(2, "ליטרים")).toEqual({ base: "ml", amount: 2000 });
  });
});
