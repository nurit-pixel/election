import "server-only";
import { pool } from "./db";
import { chainVisible, storeInRadius } from "./scope";
import { uid } from "./session";
import { basketSeries, type BasketPoint } from "./basket-history-calc";

export type { BasketPoint } from "./basket-history-calc";

export type BasketHistory = {
  points: BasketPoint[];
  /** כמה מפריטי הרשימה נכללו (פריט בלי היסטוריית מחירים לא נכלל) */
  itemsCounted: number;
  itemsTotal: number;
};

/** מדד הסל: כמה עלה הסל של הרשימה בכל יום, אם קונים כל פריט במחיר הזול ביותר באזור (מחיר מדף).
 * המסד מחזיר רק את המחיר הזול ליום לכל פריט (מבין החלופות והסניפים שבאזור); השלמת ימים חסרים והסכום
 * נעשים ב-basketSeries. כך השאילתה נשארת מהירה גם כשההיסטוריה גדלה. */
export async function basketHistory(listId: number, days = 60): Promise<BasketHistory> {
  const user = await uid();
  const [items, rows] = await Promise.all([
    pool.query(`SELECT id, quantity FROM list_items WHERE list_id = $1`, [listId]),
    pool.query(
      `WITH alts AS (
         SELECT ip.item_id, ip.product_id FROM list_item_products ip
         JOIN list_items i ON i.id = ip.item_id WHERE i.list_id = $1
       ), nearby AS (
         SELECT s.id FROM stores s JOIN chains c ON c.key = s.chain_key
         WHERE NOT c.is_pharm AND ${chainVisible(user)} AND ${storeInRadius(user)}
       ), daily AS (
         SELECT h.day, h.product_id, min(h.price) AS price
         FROM price_history h JOIN nearby n ON n.id = h.store_pk
         WHERE h.product_id IN (SELECT product_id FROM alts) AND h.day > current_date - $2::int
         GROUP BY h.day, h.product_id
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day, a.item_id, min(d.price) AS price
       FROM daily d JOIN alts a ON a.product_id = d.product_id
       GROUP BY d.day, a.item_id`,
      [listId, days],
    ),
  ]);
  const quantities = new Map(items.rows.map((r) => [r.id as number, Number(r.quantity)]));
  const { points, itemsCounted } = basketSeries(
    rows.rows.map((r) => ({ day: r.day, itemId: r.item_id, price: Number(r.price) })),
    quantities,
  );
  return { points, itemsCounted, itemsTotal: points.length > 0 ? items.rows.length : 0 };
}

/** שינוי מהנקודה הראשונה לאחרונה */
export function basketChange(points: BasketPoint[]): { amount: number; pct: number; since: string } | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const amount = Math.round((last.price - first.price) * 100) / 100;
  return { amount, pct: Math.round((amount / first.price) * 1000) / 10, since: first.day };
}
