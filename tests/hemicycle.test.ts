import { describe, it, expect } from "vitest";
import { seatPositions, seatColors, largestRemainder, HEMI_W } from "@/lib/hemicycle";
import { computeBadges, badgesByPlayer } from "@/lib/badges";

describe("seatPositions", () => {
  it("returns exactly 120 seats inside the viewBox, filling right to left", () => {
    const s = seatPositions();
    expect(s).toHaveLength(120);
    for (const p of s) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(HEMI_W);
    }
    expect(s[0].x).toBeGreaterThan(s[119].x); // RTL: first seat on the right
  });

  it("seats do not overlap", () => {
    const s = seatPositions();
    let min = Infinity;
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) min = Math.min(min, Math.hypot(s[i].x - s[j].x, s[i].y - s[j].y));
    expect(min).toBeGreaterThan(s[0].r * 2);
  });
});

describe("seatColors", () => {
  it("fills in order, pads with null, caps at 120", () => {
    const c = seatColors([{ key: "a", color: "red", count: 2 }, { key: "b", color: "blue", count: 1 }]);
    expect(c.slice(0, 4)).toEqual(["red", "red", "blue", null]);
    expect(c).toHaveLength(120);
    expect(seatColors([{ key: "a", color: "red", count: 130 }]).every((x) => x === "red")).toBe(true);
  });
});

describe("largestRemainder", () => {
  it("sums to 120 and respects proportions", () => {
    const r = largestRemainder({ a: 30.7, b: 22.7, c: 14.5, d: 52.1 });
    expect(Object.values(r).reduce((x, y) => x + y, 0)).toBe(120);
    expect(r.a).toBe(31);
    expect(r.d).toBe(52);
  });
  it("all zero → zeros", () => {
    expect(largestRemainder({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe("computeBadges", () => {
  const keys = ["x", "y"];
  it("needs at least two bets", () => {
    expect(computeBadges([{ player_id: "a", seats: { x: 60, y: 60 }, updated_at: "2026-10-01" }], keys)).toEqual({});
  });
  it("picks consensus, original and last minute", () => {
    const bets = [
      { player_id: "mid", seats: { x: 60, y: 60 }, updated_at: "2026-10-01T10:00:00Z" },
      { player_id: "near", seats: { x: 62, y: 58 }, updated_at: "2026-10-02T10:00:00Z" },
      { player_id: "far", seats: { x: 100, y: 20 }, updated_at: "2026-10-03T10:00:00Z" },
    ];
    const b = computeBadges(bets, keys);
    expect(b.original).toBe("far");
    expect(b.lastMinute).toBe("far");
    expect(["mid", "near"]).toContain(b.consensus);
    expect(badgesByPlayer(b).far).toEqual(["original", "lastMinute"]);
  });
});
