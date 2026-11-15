import { describe, expect, it } from "vitest";
import { METER_COLORS, meterLevel } from "../lib/meter";

describe("מד המחיר", () => {
  it("הזול ביותר בצבע הראשון, היקר ביותר באחרון", () => {
    expect(meterLevel(100, 100, 200)).toBe(0);
    expect(meterLevel(200, 100, 200)).toBe(METER_COLORS.length - 1);
    expect(meterLevel(150, 100, 200)).toBe(2);
    expect(meterLevel(119, 100, 200)).toBe(0);
    expect(meterLevel(121, 100, 200)).toBe(1);
  });
  it("סניף אחד, או כולם באותו מחיר: הכי זול", () => {
    expect(meterLevel(100, 100, 100)).toBe(0);
  });
});
