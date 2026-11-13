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
