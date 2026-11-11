import { describe, expect, it } from "vitest";
import { summarize, tagHeadline } from "@/lib/iran/tags";

const h = (title: string) => ({ title, link: "https://example.com", source: "x", published: null });

describe("iran headline tags", () => {
  it("tags Hebrew and English headlines by keyword", () => {
    expect(tagHeadline(h("Houthis strike Aramco headquarters in Dhahran")).tags).toEqual(["proxies"]);
    expect(tagHeadline(h("נתניהו: נגד תקיפת מנע באיראן לפני הבחירות")).tags).toEqual(["bibi", "il_elect"]);
    expect(tagHeadline(h("Iran says US response on Hormuz insufficient")).tags).toEqual(["hormuz"]);
    expect(tagHeadline(h("Weather in Tehran")).tags).toEqual([]);
  });

  it("summarizes the most frequent topics", () => {
    const items = [h("Hormuz tanker hit"), h("Tanker seized near Hormuz"), h("Trump on Iran")].map(tagHeadline);
    expect(summarize(items)).toBe("נאספו 3 כותרות מהשעות האחרונות. הנושאים הבולטים: הורמוז והסגר (2), טראמפ (1).");
    expect(summarize([])).toMatch(/לא נמצאו/);
  });
});
