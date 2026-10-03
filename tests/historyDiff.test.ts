import { describe, it, expect } from "vitest";
import { diffBets, describeChange, withChanges, type HistoryEntry } from "@/lib/historyDiff";
import type { Bet } from "@/lib/scoring";

const base: Bet = {
  seats: { likud: 30, beyachad: 24 },
  pm: "likud",
  bloc: "coalition",
  bonus: { b1: true, b2: false, b3: true, b4: false, b5: false },
};

describe("diffBets", () => {
  it("no changes → empty", () => {
    expect(diffBets(base, { ...base })).toEqual([]);
  });

  it("detects seats, pm, bloc and bonus changes", () => {
    const next: Bet = {
      seats: { likud: 28, beyachad: 26 },
      pm: "none",
      bloc: "opposition",
      bonus: { ...base.bonus, b2: true },
    };
    const d = diffBets(base, next);
    expect(d.map((c) => c.kind)).toEqual(["seats", "seats", "pm", "bloc", "bonus"]);
    expect(describeChange(d[0])).toBe("הליכוד: 30 ← 28");
    expect(describeChange(d[2])).toContain("אין ממשלה");
    expect(describeChange(d[3])).toBe("גוש: קואליציה ← אופוזיציה");
  });

  it("missing party counts as 0", () => {
    const d = diffBets(base, { ...base, seats: { ...base.seats, noam: 2 } });
    expect(d).toEqual([{ kind: "seats", party: "נעם לישראל", from: 0, to: 2 }]);
  });
});

describe("withChanges", () => {
  it("orders newest first and diffs against the previous submission", () => {
    const entries: HistoryEntry[] = [
      { ...base, id: 2, created_at: "2026-10-02T10:00:00Z", seats: { likud: 29, beyachad: 25 } },
      { ...base, id: 1, created_at: "2026-10-01T10:00:00Z" },
      { ...base, id: 3, created_at: "2026-10-03T10:00:00Z", seats: { likud: 29, beyachad: 25 } },
    ];
    const h = withChanges(entries);
    expect(h.map((e) => e.id)).toEqual([3, 2, 1]);
    expect(h[2].changes).toBeNull(); // first submission
    expect(h[1].changes).toHaveLength(2);
    expect(h[0].changes).toEqual([]); // identical resubmission
  });
});
