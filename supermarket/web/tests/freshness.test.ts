import { describe, expect, it } from "vitest";
import { freshness, freshnessText, relativeTime, spokenPrice, winnerIndex, worstFreshness } from "../lib/freshness";

const NOW = new Date("2026-11-13T12:00:00+02:00");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe("freshness", () => {
  it("רענן עד 36 שעות, מתיישן עד שבוע, ישן אחרי שבוע", () => {
    expect(freshness(ago(2), NOW)).toBe("fresh");
    expect(freshness(ago(36), NOW)).toBe("fresh");
    expect(freshness(ago(37), NOW)).toBe("aging");
    expect(freshness(ago(24 * 4), NOW)).toBe("aging");
    expect(freshness(ago(24 * 8), NOW)).toBe("stale");
  });

  it("מחיר בלי מועד עדכון הוא unknown ולא fresh", () => {
    expect(freshness(null, NOW)).toBe("unknown");
    expect(freshness(undefined, NOW)).toBe("unknown");
    expect(freshness("not a date", NOW)).toBe("unknown");
  });

  it("רעננות הסל היא של המחיר הישן ביותר", () => {
    expect(worstFreshness(["fresh", "aging", "fresh"])).toBe("aging");
    expect(worstFreshness(["fresh", "unknown", "stale"])).toBe("unknown");
    expect(worstFreshness([])).toBe("fresh");
  });
});

describe("ניסוח", () => {
  it("זמן יחסי בעברית", () => {
    expect(relativeTime(ago(2), NOW)).toBe("לפני שעתיים");
    expect(relativeTime(ago(1), NOW)).toBe("לפני שעה");
    expect(relativeTime(ago(5), NOW)).toBe("לפני 5 שעות");
    expect(relativeTime(ago(26), NOW)).toBe("אתמול");
    expect(relativeTime(ago(24 * 4), NOW)).toBe("לפני 4 ימים");
  });

  it("טקסט סטטוס לפי החוזה", () => {
    expect(freshnessText("fresh", ago(2), NOW)).toBe("עודכן לפני שעתיים");
    expect(freshnessText("aging", ago(24 * 4), NOW)).toBe("עודכן לפני 4 ימים");
    expect(freshnessText("stale", ago(24 * 9), NOW)).toContain("מחיר ישן");
    expect(freshnessText("unknown", null, NOW)).toBe("לא ידוע מתי המחיר עודכן");
  });

  it("שם נגיש למחיר", () => {
    expect(spokenPrice(284.9)).toBe("284 שקלים ו-90 אגורות");
    expect(spokenPrice(12)).toBe("12 שקלים");
    expect(spokenPrice(1)).toBe("שקל אחד");
  });
});

describe("תג הכי משתלם", () => {
  it("סל מלא ורענן, הזול מבין המלאים: מקבל תג", () => {
    expect(winnerIndex([
      { complete: true, freshness: "fresh", total: 301.2 },
      { complete: true, freshness: "fresh", total: 284.9 },
    ])).toBe(1);
  });

  it("סל חלקי עם סכום נמוך יותר אינו מקבל תג", () => {
    expect(winnerIndex([
      { complete: false, freshness: "fresh", total: 200 },
      { complete: true, freshness: "fresh", total: 284.9 },
    ])).toBe(1);
  });

  it("סל מלא עם מחיר ישן אינו מקבל תג, גם אם הוא הזול ביותר", () => {
    expect(winnerIndex([
      { complete: true, freshness: "aging", total: 250 },
      { complete: true, freshness: "fresh", total: 284.9 },
    ])).toBe(1);
    expect(winnerIndex([{ complete: true, freshness: "stale", total: 250 }])).toBe(-1);
    expect(winnerIndex([{ complete: true, freshness: "unknown", total: 250 }])).toBe(-1);
  });

  it("אין סל מלא ורענן: אין תג", () => {
    expect(winnerIndex([{ complete: false, freshness: "fresh", total: 100 }])).toBe(-1);
    expect(winnerIndex([])).toBe(-1);
  });
});
