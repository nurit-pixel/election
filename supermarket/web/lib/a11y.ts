/** העדפות נגישות: נשמרות בעוגייה (גם בלי התחברות), ומוחלות על <html> כבר ברינדור בשרת, בלי הבהוב. */
export const A11Y_COOKIE = "a11y";

export type TextSize = "normal" | "large" | "xlarge";

export type A11yPrefs = {
  /** גודל הטקסט: רגיל, גדול (112.5%), גדול מאוד (125%) */
  text: TextSize;
  /** ניגודיות גבוהה: טקסט משני וגבולות כהים יותר */
  contrast: boolean;
  /** קו תחתון לכל הקישורים */
  links: boolean;
  /** עצירת אנימציות ומעברים */
  still: boolean;
  /** גופן קריא: ריווח אותיות ושורות גדול יותר */
  readable: boolean;
};

export const DEFAULT_A11Y: A11yPrefs = { text: "normal", contrast: false, links: false, still: false, readable: false };

const FLAGS = ["contrast", "links", "still", "readable"] as const;

/** מחרוזת העוגייה, למשל "text:large,contrast,links" */
export function serializeA11y(prefs: A11yPrefs): string {
  const parts: string[] = [];
  if (prefs.text !== "normal") parts.push(`text:${prefs.text}`);
  for (const flag of FLAGS) if (prefs[flag]) parts.push(flag);
  return parts.join(",");
}

export function parseA11y(value: string | undefined | null): A11yPrefs {
  const prefs: A11yPrefs = { ...DEFAULT_A11Y };
  for (const part of (value ?? "").split(",")) {
    if (part === "text:large" || part === "text:xlarge") prefs.text = part.slice(5) as TextSize;
    else if ((FLAGS as readonly string[]).includes(part)) prefs[part as (typeof FLAGS)[number]] = true;
  }
  return prefs;
}

/** תכונות data-* ל-<html> */
export function a11yAttributes(prefs: A11yPrefs): Record<string, string | undefined> {
  return {
    "data-text": prefs.text === "normal" ? undefined : prefs.text,
    "data-contrast": prefs.contrast ? "high" : undefined,
    "data-links": prefs.links ? "underline" : undefined,
    "data-still": prefs.still ? "" : undefined,
    "data-readable": prefs.readable ? "" : undefined,
  };
}

export function isDefaultA11y(prefs: A11yPrefs): boolean {
  return serializeA11y(prefs) === "";
}
