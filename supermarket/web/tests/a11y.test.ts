import { describe, expect, it } from "vitest";
import { a11yAttributes, DEFAULT_A11Y, isDefaultA11y, parseA11y, serializeA11y } from "../lib/a11y";

describe("העדפות נגישות", () => {
  it("נשמרות ונקראות חזרה", () => {
    const prefs = { text: "xlarge" as const, contrast: true, links: false, still: true, readable: false };
    expect(serializeA11y(prefs)).toBe("text:xlarge,contrast,still");
    expect(parseA11y(serializeA11y(prefs))).toEqual(prefs);
  });
  it("ערך חסר או משובש נותן ברירת מחדל", () => {
    expect(parseA11y(undefined)).toEqual(DEFAULT_A11Y);
    expect(parseA11y("text:huge,<script>,links")).toEqual({ ...DEFAULT_A11Y, links: true });
    expect(isDefaultA11y(parseA11y(""))).toBe(true);
  });
  it("תכונות ל-html רק למה שנבחר", () => {
    expect(a11yAttributes(parseA11y("text:large,links"))).toEqual({
      "data-text": "large",
      "data-contrast": undefined,
      "data-links": "underline",
      "data-still": undefined,
      "data-readable": undefined,
    });
  });
});
