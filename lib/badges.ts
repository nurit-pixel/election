// תגים משעשעים על המשחק עצמו (לא על מפלגות): מחושבים מההימורים בלבד.

export type BadgeKey = "consensus" | "original" | "lastMinute";

export const BADGES: Record<BadgeKey, { icon: string; title: string; desc: string }> = {
  consensus: { icon: "🎯", title: "הכי קונצנזוס", desc: "ההימור הכי קרוב לממוצע של הקבוצה" },
  original: { icon: "🦄", title: "הכי מקורי", desc: "ההימור הכי רחוק מהממוצע של הקבוצה" },
  lastMinute: { icon: "⏰", title: "ברגע האחרון", desc: "העדכון האחרון לפני הנעילה" },
};

export type BadgeInput = { player_id: string; seats: Record<string, number>; updated_at: string };

/** מרחק מנהטן בין הימור לממוצע הקבוצה */
export function distanceFromAverage(seats: Record<string, number>, avg: Record<string, number>): number {
  return Object.keys(avg).reduce((s, k) => s + Math.abs((seats[k] ?? 0) - avg[k]), 0);
}

/** מחזיר לכל תג את השחקן שמחזיק בו. צריך לפחות 2 הימורים כדי שיהיה טעם. שוויון נשבר לפי player_id. */
export function computeBadges(bets: BadgeInput[], keys: string[]): Partial<Record<BadgeKey, string>> {
  if (bets.length < 2) return {};
  const avg = Object.fromEntries(keys.map((k) => [k, bets.reduce((s, b) => s + (b.seats[k] ?? 0), 0) / bets.length]));
  const scored = bets
    .map((b) => ({ id: b.player_id, d: distanceFromAverage(b.seats, avg), t: new Date(b.updated_at).getTime() }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const pick = (cmp: (a: (typeof scored)[0], b: (typeof scored)[0]) => number) => [...scored].sort(cmp)[0].id;
  return {
    consensus: pick((a, b) => a.d - b.d),
    original: pick((a, b) => b.d - a.d),
    lastMinute: pick((a, b) => b.t - a.t),
  };
}

/** היפוך: לכל שחקן — רשימת התגים שלו */
export function badgesByPlayer(badges: Partial<Record<BadgeKey, string>>): Record<string, BadgeKey[]> {
  const out: Record<string, BadgeKey[]> = {};
  for (const [k, id] of Object.entries(badges) as [BadgeKey, string][]) (out[id] ??= []).push(k);
  return out;
}
