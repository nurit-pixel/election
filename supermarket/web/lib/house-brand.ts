/** מותגי הבית של הרשתות: מוצר שהשם או היצרן שלו מזכירים את הרשת. לוגיקה טהורה. */
const HOUSE_BRANDS: [RegExp, string][] = [
  [/שופרסל/, "שופרסל"],
  [/רמי לוי/, "רמי לוי"],
  [/ויקטורי/, "ויקטורי"],
  [/יוחננוף/, "יוחננוף"],
  [/אושר עד/, "אושר עד"],
  [/טיב טעם/, "טיב טעם"],
  [/קרפור|carrefour/i, "קרפור"],
  [/יינות ביתן/, "יינות ביתן"],
  [/חצי חינם/, "חצי חינם"],
  [/מחסני השוק/, "מחסני השוק"],
  [/קשת טעמים/, "קשת טעמים"],
];

/** שם הרשת שזה מותג הבית שלה, או null */
export function houseBrand(name: string, manufacturer: string | null = null): string | null {
  const text = `${name} ${manufacturer ?? ""}`;
  for (const [pattern, chain] of HOUSE_BRANDS) if (pattern.test(text)) return chain;
  return null;
}
