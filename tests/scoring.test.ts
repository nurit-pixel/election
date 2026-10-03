import { describe, it, expect } from "vitest";
import { score, seatPoints, rank, tier, type Bet, type Results } from "@/lib/scoring";
import { PARTY_KEYS } from "@/lib/parties";
import { BONUS_KEYS } from "@/lib/copy";

// 14 מפלגות: 8 עוברות, 6 לא. סכום 120.
const ACTUAL: Record<string, number> = Object.fromEntries(PARTY_KEYS.map((k) => [k, 0]));
Object.assign(ACTUAL, { likud: 30, beyachad: 24, yashar: 14, democrats: 10, shas: 10, utj: 8, beiteinu: 12, raam: 12 });

const RESULTS: Results = {
  seats: ACTUAL,
  pm: "likud",
  bloc: "coalition",
  bonus: { b1: true, b2: false, b3: true, b4: false, b5: false },
};

const perfect: Bet = {
  seats: { ...ACTUAL },
  pm: "likud",
  bloc: "coalition",
  bonus: { b1: true, b2: false, b3: true, b4: false, b5: false },
};

describe("seatPoints", () => {
  it.each([
    [0, 10],
    [1, 7],
    [2, 4],
    [3, 2],
    [4, 0],
    [5, 0],
  ])("distance %i → %i", (d, pts) => {
    expect(seatPoints(20 + d, 20)).toBe(pts);
    expect(seatPoints(20 - d, 20)).toBe(pts);
  });
});

describe("score", () => {
  it("sanity: fixtures", () => {
    expect(PARTY_KEYS).toHaveLength(14);
    expect(BONUS_KEYS).toHaveLength(5);
    expect(Object.values(ACTUAL).reduce((a, b) => a + b, 0)).toBe(120);
  });

  it("perfect bet = 200", () => {
    const s = score(perfect, RESULTS);
    expect(s).toEqual({ total: 200, seat_pts: 140, pm_pts: 25, bloc_pts: 10, bonus_pts: 25, exact_hits: 14 });
  });

  it("empty case = 0", () => {
    // כל ניחוש רחוק ב-4+ מהתוצאה, רה"מ/גוש/בונוסים הפוכים
    const seats = Object.fromEntries(PARTY_KEYS.map((k) => [k, ACTUAL[k] >= 4 ? ACTUAL[k] - 4 : ACTUAL[k] + 4]));
    const bet: Bet = {
      seats,
      pm: "none",
      bloc: "opposition",
      bonus: { b1: false, b2: true, b3: false, b4: true, b5: true },
    };
    const s = score(bet, RESULTS);
    expect(s.total).toBe(0);
    expect(s.exact_hits).toBe(0);
  });

  it("no results = 0", () => {
    expect(score(perfect, { seats: null, pm: null, bloc: null, bonus: null }).total).toBe(0);
  });

  it.each([
    [0, 10],
    [1, 7],
    [2, 4],
    [3, 2],
    [4, 0],
    [5, 0],
  ])("single party off by %i → seat_pts reduced correctly", (d, pts) => {
    const bet = { ...perfect, seats: { ...perfect.seats, likud: 30 + d } };
    expect(score(bet, RESULTS).seat_pts).toBe(130 + pts);
  });

  it("party that did not pass: guess 0 = 10, guess 3 = 2", () => {
    expect(ACTUAL.noam).toBe(0);
    const zero = score(perfect, RESULTS);
    const three = score({ ...perfect, seats: { ...perfect.seats, noam: 3 } }, RESULTS);
    expect(zero.seat_pts - three.seat_pts).toBe(8);
    expect(three.exact_hits).toBe(13);
  });

  it("missing party in bet counts as 0", () => {
    const { noam: _n, ...rest } = perfect.seats;
    expect(score({ ...perfect, seats: rest }, RESULTS).seat_pts).toBe(140);
  });

  it("pm other: compared after trim + lowercase", () => {
    const res: Results = { ...RESULTS, pm: "other:John Doe" };
    expect(score({ ...perfect, pm: "other:  john doe " }, res).pm_pts).toBe(25);
    expect(score({ ...perfect, pm: "other:jane" }, res).pm_pts).toBe(0);
    expect(score({ ...perfect, pm: "likud" }, res).pm_pts).toBe(0);
  });

  it("pm none matches none", () => {
    expect(score({ ...perfect, pm: "none" }, { ...RESULTS, pm: "none" }).pm_pts).toBe(25);
  });

  it("unknown bonus answers give no points", () => {
    const res: Results = { ...RESULTS, bonus: { b1: true, b2: null, b3: null, b4: null, b5: null } };
    expect(score(perfect, res).bonus_pts).toBe(5);
  });
});

describe("tier", () => {
  it.each([
    [0, "פעיל שטח"],
    [60, "פעיל שטח"],
    [61, "יועץ אסטרטגי"],
    [110, "יועץ אסטרטגי"],
    [111, "מנהל קמפיין"],
    [150, "מנהל קמפיין"],
    [151, "סוקר-על"],
    [180, "סוקר-על"],
    [181, "נביא/ת הקלפי"],
    [200, "נביא/ת הקלפי"],
  ])("%i → %s", (t, name) => expect(tier(t)).toBe(name));
});

describe("rank — tie breaking", () => {
  const base = { seat_pts: 0, bloc_pts: 0, bonus_pts: 0 };

  it("total desc first", () => {
    const r = rank([
      { ...base, id: "a", total: 50, pm_pts: 0, exact_hits: 0, submitted_at: "2026-10-01T10:00:00Z" },
      { ...base, id: "b", total: 90, pm_pts: 0, exact_hits: 0, submitted_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(r.map((x) => [x.id, x.place])).toEqual([["b", 1], ["a", 2]]);
  });

  it("equal total → pm_pts desc → exact_hits desc → submitted_at asc", () => {
    const r = rank([
      { ...base, id: "late", total: 100, pm_pts: 0, exact_hits: 5, submitted_at: "2026-10-05T10:00:00Z" },
      { ...base, id: "early", total: 100, pm_pts: 0, exact_hits: 5, submitted_at: "2026-10-01T10:00:00Z" },
      { ...base, id: "hits", total: 100, pm_pts: 0, exact_hits: 7, submitted_at: "2026-10-09T10:00:00Z" },
      { ...base, id: "pm", total: 100, pm_pts: 25, exact_hits: 0, submitted_at: "2026-10-10T10:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["pm", "hits", "early", "late"]);
    expect(r.map((x) => x.place)).toEqual([1, 2, 3, 4]);
  });
});
