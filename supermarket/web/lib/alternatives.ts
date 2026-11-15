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

/** ההצעות נשמרות בזיכרון לחצי שעה, לכל משתמש ומוצר: חישוב הצעה כבד (כל המוצרים הדומים וכל המחירים
 * באזור), ומסך הרשימה מתרנדר מחדש בכל לחיצה (כמות, הסרה, הוספה). כך רק מוצר חדש ברשימה מחושב. */
const CACHE_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 5000;
const cache = new Map<string, { at: number; suggestion: Suggestion | null }>();

function cached(key: string, now: number): Suggestion | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (now - entry.at > CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.suggestion;
}

function remember(key: string, suggestion: Suggestion | null, now: number) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: now, suggestion });
}

/** הצעות לחלופה זולה לפריטים ברשימה שיש בהם מוצר אחד בלבד. מפתח: מזהה הפריט. */
export async function suggestionsFor(items: ListItem[]): Promise<Map<number, Suggestion>> {
  const result = new Map<number, Suggestion>();
  const single = items.filter((item) => item.products.length === 1 && !item.products[0].chainName);
  if (single.length === 0) return result;
  const user = await uid();
  const now = Date.now();
  const keyOf = (productId: number) => `${user}:${productId}`;

  const missing: ListItem[] = [];
  for (const item of single) {
    const hit = cached(keyOf(item.products[0].id), now);
    if (hit === undefined) missing.push(item);
    else if (hit) result.set(item.id, hit);
  }
  if (missing.length === 0) return result;

  const computed = await compute(user, [...new Set(missing.map((item) => item.products[0].id))]);
  for (const item of missing) {
    const productId = item.products[0].id;
    const suggestion = computed.get(productId) ?? null;
    remember(keyOf(productId), suggestion, now);
    if (suggestion) result.set(item.id, suggestion);
  }
  return result;
}

/** חישוב ההצעות למוצרים, לפי המחירים בסניפים שברדיוס של המשתמש */
async function compute(user: number, productIds: number[]): Promise<Map<number, Suggestion>> {
  const result = new Map<number, Suggestion>();
  // הסניפים שברדיוס, פעם אחת, והמחיר הזול בהם לכל מוצר
  const nearby = `nearby AS (
    SELECT s.id FROM stores s JOIN chains c ON c.key = s.chain_key
    WHERE ${chainVisible(user)} AND ${storeInRadius(user)})`;

  const references = await pool.query(
    `WITH ${nearby}
     SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, min(pr.price) AS min_price
     FROM products p JOIN prices pr ON pr.product_id = p.id JOIN nearby n ON n.id = pr.store_pk
     WHERE p.id = ANY($1)
     GROUP BY p.id`,
    [productIds],
  );
  if (references.rows.length === 0) return result;
  const words = [...new Set(references.rows.map((r) => String(r.name).trim().split(/\s+/)[0]).filter((w) => w.length >= 3))];
  if (words.length === 0) return result;
  // רק מוצרים שהמילה הראשונה שלהם זהה (אינדקס first_word), ושיש להם מחיר באזור
  const candidates = await pool.query(
    `WITH ${nearby}
     SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, min(pr.price) AS min_price
     FROM products p JOIN prices pr ON pr.product_id = p.id JOIN nearby n ON n.id = pr.store_pk
     WHERE p.internal_chain = '' AND split_part(p.name, ' ', 1) = ANY($1)
     GROUP BY p.id
     LIMIT 3000`,
    [words],
  );
  const offers = candidates.rows.map(toOffer);
  for (const r of references.rows) {
    const suggestion = suggestAlternative(toOffer(r), offers);
    if (suggestion) result.set(r.id as number, suggestion);
  }
  return result;
}

/** שינוי בכתובות משנה את הסניפים שבאזור: ההצעות של המשתמש מחושבות מחדש */
export function forgetSuggestions(user: number): void {
  for (const key of cache.keys()) if (key.startsWith(`${user}:`)) cache.delete(key);
}
