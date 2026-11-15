import "server-only";
import { pool } from "./db";
import { chainVisible, storeInRadius } from "./scope";
import { uid } from "./session";
import { suggestAlternative, type ProductOffer, type Suggestion } from "./alternatives-calc";
import type { ListItem } from "./lists";

const toOffer = (r: Record<string, unknown>): ProductOffer => ({
  id: r.id as number,
  name: r.name as string,
  isWeighted: r.is_weighted as boolean,
  manufacturer: (r.manufacturer as string) ?? null,
  quantity: r.quantity == null ? null : Number(r.quantity),
  unit: (r.unit_qty as string) ?? null,
  minPrice: Number(r.min_price),
});

/** הצעות לחלופה זולה לפריטים ברשימה שיש בהם מוצר אחד בלבד. מפתח: מזהה הפריט. */
export async function suggestionsFor(items: ListItem[]): Promise<Map<number, Suggestion>> {
  const result = new Map<number, Suggestion>();
  const single = items.filter((item) => item.products.length === 1 && !item.products[0].chainName);
  if (single.length === 0) return result;
  const user = await uid();
  const nearby = `EXISTS (SELECT 1 FROM prices pr JOIN stores s ON s.id = pr.store_pk JOIN chains c ON c.key = s.chain_key
                          WHERE pr.product_id = p.id AND ${chainVisible(user)} AND ${storeInRadius(user)})`;
  const minPrice = `(SELECT min(pr.price) FROM prices pr JOIN stores s ON s.id = pr.store_pk JOIN chains c ON c.key = s.chain_key
                     WHERE pr.product_id = p.id AND ${chainVisible(user)} AND ${storeInRadius(user)})`;

  const references = await pool.query(
    `SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, ${minPrice} AS min_price
     FROM products p WHERE p.id = ANY($1) AND ${nearby}`,
    [single.map((item) => item.products[0].id)],
  );
  if (references.rows.length === 0) return result;
  const words = [...new Set(references.rows.map((r) => String(r.name).trim().split(/\s+/)[0]).filter((w) => w.length >= 3))];
  if (words.length === 0) return result;
  const candidates = await pool.query(
    `SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, ${minPrice} AS min_price
     FROM products p
     WHERE p.internal_chain = '' AND split_part(p.name, ' ', 1) = ANY($1) AND ${nearby}
     LIMIT 3000`,
    [words],
  );
  const offers = candidates.rows.map(toOffer);
  const byId = new Map(references.rows.map((r) => [r.id as number, toOffer(r)]));
  for (const item of single) {
    const reference = byId.get(item.products[0].id);
    if (!reference) continue;
    const suggestion = suggestAlternative(reference, offers);
    if (suggestion) result.set(item.id, suggestion);
  }
  return result;
}
