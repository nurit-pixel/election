import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import { assess } from "@/lib/iran/assess";
import type { Headline } from "@/lib/iran/types";

const headlines: Headline[] = [
  { title: "Houthis strike Aramco HQ", link: "https://example.com/a", source: "Reuters", published: null },
  { title: "Netanyahu: no strike before election", link: "https://example.com/b", source: "ynet", published: null },
];

function reply(obj: unknown, stop = "end_turn") {
  create.mockResolvedValueOnce({ model: "claude-opus-5-5", stop_reason: stop, content: [{ type: "text", text: JSON.stringify(obj) }] });
}

const base = { status: {}, recentNews: [], headlines, quotes: {}, now: new Date("2026-10-15T10:00:00Z") };

describe("iran assess", () => {
  it("limits each change to one step, clamps to range and ignores unknown ids", async () => {
    reply({
      summary: "ok",
      changes: [
        { id: "proxies", value: 2, status: "חדש", reason: "r", sources: [0] },
        { id: "leash", value: -9, status: "x", reason: "r", sources: [] },
        { id: "fin", value: 2, status: "x", reason: "r", sources: [] },
        { id: "nope", value: 1, status: "x", reason: "r", sources: [] },
      ],
      news: [],
    });
    const a = await assess({ ...base, values: { proxies: 0, leash: -1 } });
    expect(a.values.proxies).toBe(1);
    expect(a.values.leash).toBe(-2);
    expect(a.values.fin).toBeUndefined();
    expect(a.values.nope).toBeUndefined();
    expect(a.status.proxies.src).toEqual([["Reuters", "https://example.com/a"]]);
  });

  it("keeps only news that points at a real headline", async () => {
    reply({
      summary: "s",
      changes: [],
      news: [
        { headline: 1, title: "נתניהו", body: "b", effect: "down", indicator: "il_elect" },
        { headline: 7, title: "מומצא", body: "b", effect: "up", indicator: "none" },
      ],
    });
    const a = await assess({ ...base, values: {} });
    expect(a.news).toHaveLength(1);
    expect(a.news[0]).toMatchObject({ u: "https://example.com/b", ind: "il_elect", s: "ynet" });
  });

  it("throws on a refusal instead of reading content", async () => {
    reply({}, "refusal");
    await expect(assess({ ...base, values: {} })).rejects.toThrow(/declined/);
  });
});
