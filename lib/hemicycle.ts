// חישובים טהורים לתרשים "כנסת" בחצי עיגול: מיקומי 120 המושבים וצביעתם.

export type Seat = { x: number; y: number; r: number };
export type Segment = { key: string; color: string; count: number };

export const HEMI_W = 200;
export const HEMI_H = 104;

/**
 * מיקומי מושבים בחצי עיגול, ממוינים לפי סדר המילוי: מימין לשמאל (RTL),
 * ובכל "פרוסה" מבפנים החוצה — כך שכל מפלגה מקבלת גוש רציף.
 */
export function seatPositions(total = 120, rows = 8): Seat[] {
  const cx = HEMI_W / 2;
  const cy = HEMI_H - 4;
  const outer = 96;
  const inner = outer * 0.36;
  const radii = Array.from({ length: rows }, (_, i) => inner + ((outer - inner) * i) / (rows - 1));
  const sumR = radii.reduce((a, b) => a + b, 0);

  // מספר מושבים בכל שורה — יחסי לרדיוס, מתוקן כך שהסכום יהיה בדיוק total
  const counts = radii.map((r) => Math.floor((total * r) / sumR));
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = radii.map((r, i) => ({ i, frac: (total * r) / sumR - counts[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k = (k + 1) % rows, left--) counts[order[k].i]++;

  const seatR = ((outer - inner) / (rows - 1)) * 0.4;
  const seats: (Seat & { angle: number })[] = [];
  radii.forEach((radius, row) => {
    const n = counts[row];
    for (let j = 0; j < n; j++) {
      const angle = n === 1 ? Math.PI / 2 : (Math.PI * j) / (n - 1); // 0 = ימין, π = שמאל
      seats.push({ x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle), r: seatR, angle });
    }
  });
  return seats
    .sort((a, b) => a.angle - b.angle || Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    .map(({ x, y, r }) => ({ x, y, r }));
}

/** מחזיר צבע לכל מושב לפי הסדר; מושבים שלא חולקו מקבלים null. */
export function seatColors(segments: Segment[], total = 120): (string | null)[] {
  const out: (string | null)[] = [];
  for (const s of segments) for (let i = 0; i < s.count && out.length < total; i++) out.push(s.color);
  while (out.length < total) out.push(null);
  return out;
}

/**
 * עיגול ממוצעים ל-120 מושבים שלמים בשיטת השארית הגדולה (Hamilton).
 * קלט: ערך לא שלילי לכל מפתח. אם הכל אפס — מחזיר אפסים.
 */
export function largestRemainder(values: Record<string, number>, total = 120): Record<string, number> {
  const keys = Object.keys(values);
  const sum = keys.reduce((s, k) => s + Math.max(0, values[k]), 0);
  if (sum <= 0) return Object.fromEntries(keys.map((k) => [k, 0]));
  const quotas = keys.map((k) => ({ k, q: (Math.max(0, values[k]) * total) / sum }));
  const out = Object.fromEntries(quotas.map(({ k, q }) => [k, Math.floor(q)]));
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  quotas
    .sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q)) || b.q - a.q)
    .forEach(({ k }) => {
      if (left > 0) {
        out[k]++;
        left--;
      }
    });
  return out;
}
