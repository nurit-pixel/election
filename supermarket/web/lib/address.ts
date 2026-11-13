/** ניקוי כתובת לפני איתור. חייב להיות זהה ל-_tidy ב-ingest/ingest/geocode.py, כי התוצאה היא המפתח ב-geocode_cache. */
export function tidyAddress(text: string): string {
  return text
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[ ,-]+|[ ,-]+$/g, "");
}

/** התוצאה בתוך גבולות ישראל (אותם גבולות כמו ב-ingest) */
export function inIsrael(lat: number, lng: number): boolean {
  return lat >= 29.3 && lat <= 33.5 && lng >= 34.1 && lng <= 36.0;
}

export type AddressQuery = { query: string; /** exact = הכתובת המלאה · street = בלי מספר הבית · city = העיר בלבד */ level: "exact" | "street" | "city" };

/** השאילתות שמנסים לכתובת, מהמדויקת לרחבה: הכתובת המלאה, בלי מספר הבית, ואז העיר בלבד (מה שאחרי הפסיק האחרון). */
export function addressQueries(address: string): AddressQuery[] {
  const full = tidyAddress(address);
  const queries: AddressQuery[] = [];
  const push = (query: string, level: AddressQuery["level"]) => {
    const clean = tidyAddress(query);
    if (clean.length >= 2 && !queries.some((q) => q.query === clean)) queries.push({ query: clean, level });
  };
  push(full, "exact");
  push(full.replace(/(^|[\s,])\d+[א-ת]?(?=$|[\s,])/g, "$1"), "street");
  if (full.includes(",")) push(full.slice(full.lastIndexOf(",") + 1), "city");
  return queries;
}

/** שם קצר של המקום שזוהה, מתוך השם המלא ששירות האיתור מחזיר */
export function shortPlaceName(displayName: string): string {
  return displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== "ישראל" && !part.startsWith("מחוז") && !part.startsWith("נפת") && !/^\d{5,7}$/.test(part))
    .slice(0, 4)
    .join(", ");
}

/** האם מספר הבית שבכתובת מופיע במקום שזוהה. אם לא, שירות האיתור מצא רק את הרחוב. */
export function houseNumberMatched(address: string, displayName: string): boolean {
  const number = tidyAddress(address).match(/(?:^|[\s,])(\d+)[א-ת]?(?=$|[\s,])/)?.[1];
  if (!number) return true;
  return displayName.split(",").some((part) => new RegExp(`^${number}(\\D|$)`).test(part.trim()));
}
