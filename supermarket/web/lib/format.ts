const TZ = "Asia/Jerusalem";

export function formatPrice(price: number): string {
  return `₪${Number(price).toFixed(2)}`;
}

/** "היום 03:00", "אתמול 03:00" או "10.11 03:00" */
export function formatUpdated(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (day(d) === day(now)) return `היום ${time}`;
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return `אתמול ${time}`;
  const date = d.toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
  return `${date} ${time}`;
}

/** כמות לתצוגה: "1.5 ק״ג" למוצר שקיל, "×2" ליחידות */
export function formatQuantity(quantity: number, isWeighted: boolean): string {
  return isWeighted ? `${Number(quantity.toFixed(3))} ק״ג` : `×${quantity}`;
}

export function formatDistance(km: number | null): string {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 100) * 10} מ׳` : `${km.toFixed(1)} ק״מ`;
}
