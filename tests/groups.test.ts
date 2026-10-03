import { describe, it, expect } from "vitest";
import { groupScore, newSlug, rankGroup, type GroupQuestion } from "@/lib/groupScore";
import { hashPin, verifyPin, weakPin, PIN_RE } from "@/lib/pin";
import type { Score } from "@/lib/scoring";

const base: Score = { total: 180, seat_pts: 120, pm_pts: 25, bloc_pts: 10, bonus_pts: 25, exact_hits: 8 };

describe("groupScore", () => {
  it("no custom questions → global score unchanged", () => {
    expect(groupScore(base, [], {})).toEqual(base);
  });

  it("custom questions replace the global bonus", () => {
    const qs: GroupQuestion[] = [
      { id: "q1", position: 1, text: "א", answer: true },
      { id: "q2", position: 2, text: "ב", answer: false },
      { id: "q3", position: 3, text: "ג", answer: null }, // not answered yet by owner
    ];
    const s = groupScore(base, qs, { q1: true, q2: true, q3: true });
    expect(s.bonus_pts).toBe(5);
    expect(s.total).toBe(120 + 25 + 10 + 5);
  });

  it("unanswered by member → no points", () => {
    const qs: GroupQuestion[] = [{ id: "q1", position: 1, text: "א", answer: true }];
    expect(groupScore(base, qs, {}).bonus_pts).toBe(0);
  });
});

describe("rankGroup", () => {
  it("adds place and tier", () => {
    const r = rankGroup([
      { ...base, total: 100, submitted_at: "2026-10-01" },
      { ...base, total: 190, submitted_at: "2026-10-02" },
    ]);
    expect(r[0].total).toBe(190);
    expect(r[0].place).toBe(1);
    expect(r[0].tier).toBeTruthy();
  });
});

describe("newSlug", () => {
  it("8 chars from the safe alphabet", () => {
    const s = newSlug((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(s).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  });
});

describe("pin", () => {
  it("hashes and verifies", () => {
    const h = hashPin("4821");
    expect(h).not.toContain("4821");
    expect(verifyPin("4821", h)).toBe(true);
    expect(verifyPin("4822", h)).toBe(false);
    expect(verifyPin("4821", "garbage")).toBe(false);
  });
  it("same pin → different hashes (salted)", () => {
    expect(hashPin("4821")).not.toBe(hashPin("4821"));
  });
  it("format and weak pins", () => {
    expect(PIN_RE.test("0042")).toBe(true);
    expect(PIN_RE.test("123")).toBe(false);
    expect(weakPin("1111")).toBe(true);
    expect(weakPin("1234")).toBe(true);
    expect(weakPin("4821")).toBe(false);
  });
});
