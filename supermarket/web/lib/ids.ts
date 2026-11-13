/** מזהה מתוך כתובת הדף: מספר שלם חיובי בטווח של עמודת integer במסד, אחרת null. */
export function pageId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && id <= 2147483647 ? id : null;
}
