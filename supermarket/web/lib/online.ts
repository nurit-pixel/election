/** קישור להזמנה אונליין, לסניפים שהרשת מסמנת כאונליין/משלוחים (StoreType 2 או 3 בקובץ הסניפים). */

/** אתרי ההזמנה של הרשתות שיש להן סניף אונליין. רשת שאינה כאן מקבלת חיפוש בגוגל. */
const ONLINE_SITES: Record<string, string> = {
  SHUFERSAL: "https://www.shufersal.co.il/online/",
  RAMI_LEVY: "https://www.rami-levy.co.il/he",
  VICTORY_NEW_SOURCE: "https://www.victoryonline.co.il/",
  TIV_TAAM: "https://www.tivtaam.co.il/",
  YOHANANOF: "https://yochananof.co.il/",
  YAYNO_BITAN_AND_CARREFOUR: "https://www.carrefour.co.il/",
  WOLT: "https://wolt.com/he/isr",
};

/** "2" אונליין בלבד, "3" גם וגם */
export function isOnlineStore(storeType: string | null | undefined): boolean {
  return storeType === "2" || storeType === "3";
}

/** רק אונליין: אין טעם בניווט לכתובת (בדרך כלל מחסן ליקוט) */
export function isOnlineOnly(storeType: string | null | undefined): boolean {
  return storeType === "2";
}

export function onlineLink(store: { chainKey: string; chainName: string; name: string; storeType: string | null }): string | null {
  if (!isOnlineStore(store.storeType)) return null;
  const site = ONLINE_SITES[store.chainKey];
  if (site) return site;
  return `https://www.google.com/search?q=${encodeURIComponent(`${store.chainName} הזמנה אונליין`)}`;
}
