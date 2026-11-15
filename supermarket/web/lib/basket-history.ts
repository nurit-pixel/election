import "server-only";
import { pool } from "./db";
import { chainVisible, storeInRadius } from "./scope";
import { uid } from "./session";

export type BasketPoint = { day: string; price: number };

export type BasketHistory = {
  points: BasketPoint[];
  /** כמה מפריטי הרשימה נכללו (פריט בלי היסטוריית מחירים לא נכלל) */
  itemsCounted: number;
  itemsTotal: number;
};

/** מדד הסל: כמה עלה הסל של הרשימה בכל יום, אם קונים כל פריט במחיר הזול ביותר באזור (מחיר מדף).
 * לכל סניף ופריט נלקח המחיר האחרון שידוע עד אותו יום (עד שבוע אחורה), והחלופה הזולה של הפריט. */
export async function basketHistory(listId: number, days = 60): Promise<BasketHistory> {
  const user = await uid();
  const { rows } = await pool.query(
    `WITH items AS (
       SELECT i.id, i.quantity FROM list_items i WHERE i.list_id = $1
     ), alts AS (
       SELECT ip.item_id, ip.product_id FROM list_item_products ip JOIN items ON items.id = ip.item_id
     ), shops AS (
       SELECT DISTINCT h.store_pk AS id FROM price_history h
       JOIN stores s ON s.id = h.store_pk JOIN chains c ON c.key = s.chain_key
       WHERE h.product_id IN (SELECT product_id FROM alts) AND h.day > current_date - $2::int
         AND NOT c.is_pharm AND ${chainVisible(user)} AND ${storeInRadius(user)}
     ), days AS (
       SELECT DISTINCT h.day FROM price_history h
       WHERE h.product_id IN (SELECT product_id FROM alts) AND h.day > current_date - $2::int
     ), item_price AS (
       SELECT d.day, sh.id AS store_pk, a.item_id, min(last.price) AS price
       FROM days d CROSS JOIN shops sh JOIN alts a ON true
       JOIN LATERAL (
         SELECT h.price FROM price_history h
         WHERE h.product_id = a.product_id AND h.store_pk = sh.id AND h.day <= d.day AND h.day > d.day - 7
         ORDER BY h.day DESC LIMIT 1
       ) last ON true
       GROUP BY d.day, sh.id, a.item_id
     ), cheapest AS (
       -- לכל פריט ויום: המחיר הזול ביותר באזור, בכל סניף שהוא
       SELECT day, item_id, min(price) AS price FROM item_price GROUP BY day, item_id
     ), counted AS (
       -- פריטים שיש להם מחיר ביום האחרון: רק הם נכללים, כדי שפריט חדש בלי היסטוריה לא יעלים את הגרף
       SELECT item_id FROM cheapest WHERE day = (SELECT max(day) FROM days)
     ), day_total AS (
       SELECT ch.day, sum(ch.price * it.quantity) AS total
       FROM cheapest ch JOIN items it ON it.id = ch.item_id
       WHERE ch.item_id IN (SELECT item_id FROM counted)
       GROUP BY ch.day
       HAVING count(*) = (SELECT count(*) FROM counted)
     )
     SELECT to_char(day, 'YYYY-MM-DD') AS day, total AS price,
            (SELECT count(*) FROM counted) AS counted, (SELECT count(*) FROM items) AS total_items
     FROM day_total ORDER BY day`,
    [listId, days],
  );
  return {
    points: rows.map((r) => ({ day: r.day, price: Math.round(Number(r.price) * 100) / 100 })),
    itemsCounted: rows.length > 0 ? Number(rows[0].counted) : 0,
    itemsTotal: rows.length > 0 ? Number(rows[0].total_items) : 0,
  };
}

/** שינוי מהנקודה הראשונה לאחרונה */
export function basketChange(points: BasketPoint[]): { amount: number; pct: number; since: string } | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const amount = Math.round((last.price - first.price) * 100) / 100;
  return { amount, pct: Math.round((amount / first.price) * 1000) / 10, since: first.day };
}
