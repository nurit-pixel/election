import "server-only";
import { pool } from "./db";
import { chainVisible, storeInRadius } from "./scope";
import { uid } from "./session";
import { relatedProducts, suggestAlternative, type ProductOffer, type Related, type Suggestion } from "./alternatives-calc";
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

/** ההצעות נשמרות בזיכרון לחצי שעה, לכל משתמש: חישוב הצעה כבד (כל המוצרים הדומים וכל המחירים באזור), ומסך
 * הרשימה וההשוואה מתרנדרים מחדש בכל לחיצה. כך רק מוצר חדש ברשימה מחושב. */
const CACHE_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 5000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, now: number): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (now - entry.at > CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function remember(key: string, value: unknown, now: number) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: now, value });
}

/** הצעות לחלופה זולה לפריטים ברשימה שיש בהם מוצר אחד בלבד. מפתח: מזהה הפריט. */
export async function suggestionsFor(items: ListItem[]): Promise<Map<number, Suggestion>> {
  const result = new Map<number, Suggestion>();
  const single = items.filter((item) => item.products.length === 1 && !item.products[0].chainName && !item.anyBrand);
  if (single.length === 0) return result;
  const user = await uid();
  const now = Date.now();
  const keyOf = (productId: number) => `${user}:s:${productId}`;

  const missing: ListItem[] = [];
  for (const item of single) {
    const hit = cached<Suggestion | null>(keyOf(item.products[0].id), now);
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

type Offers = {
  references: ProductOffer[];
  candidates: ProductOffer[];
  /** לכל מוצר: המוצרים שהמשתמש סימן "לא דומה" */
  dismissed: Map<number, Set<number>>;
};

/** המוצרים (עם המחיר הזול באזור), המועמדים – מוצרים שהמילה הראשונה שלהם זהה ויש להם מחיר באזור – והמוצרים
 * שסומנו "לא דומה". withHouseBrands: גם מוצרים בקוד פנימי של רשת (מותג הבית), שיש להם מחיר רק באותה רשת. */
async function loadOffers(user: number, productIds: number[], withHouseBrands = false): Promise<Offers> {
  const empty: Offers = { references: [], candidates: [], dismissed: new Map() };
  // הסניפים שברדיוס, פעם אחת, והמחיר הזול בהם לכל מוצר
  const nearby = `nearby AS (
    SELECT s.id FROM stores s JOIN chains c ON c.key = s.chain_key
    WHERE ${chainVisible(user)} AND ${storeInRadius(user)})`;

  const [references, dismissedRows] = await Promise.all([
    pool.query(
      `WITH ${nearby}
       SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, min(pr.price) AS min_price
       FROM products p JOIN prices pr ON pr.product_id = p.id JOIN nearby n ON n.id = pr.store_pk
       WHERE p.id = ANY($1)
       GROUP BY p.id`,
      [productIds],
    ),
    pool.query(`SELECT product_id, alternative_id FROM dismissed_alternatives WHERE user_id = $1 AND product_id = ANY($2)`, [
      user,
      productIds,
    ]),
  ]);
  const dismissed = new Map<number, Set<number>>();
  for (const r of dismissedRows.rows) {
    if (!dismissed.has(r.product_id)) dismissed.set(r.product_id, new Set());
    dismissed.get(r.product_id)!.add(r.alternative_id);
  }
  if (references.rows.length === 0) return { ...empty, dismissed };
  const words = [...new Set(references.rows.map((r) => String(r.name).trim().split(/\s+/)[0]).filter((w) => w.length >= 3))];
  if (words.length === 0) return { references: references.rows.map(toOffer), candidates: [], dismissed };
  // מותגי הבית: אינדקס המילה הראשונה על כל המוצרים; אחרת האינדקס החלקי על מוצרים בברקוד רגיל בלבד
  const where = withHouseBrands
    ? `split_part(p.name, ' ', 1) = ANY($1)`
    : `p.internal_chain = '' AND split_part(p.name, ' ', 1) = ANY($1)`;
  const candidates = await pool.query(
    `WITH ${nearby}
     SELECT p.id, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty, min(pr.price) AS min_price
     FROM products p JOIN prices pr ON pr.product_id = p.id JOIN nearby n ON n.id = pr.store_pk
     WHERE ${where}
     GROUP BY p.id
     LIMIT 3000`,
    [words],
  );
  return { references: references.rows.map(toOffer), candidates: candidates.rows.map(toOffer), dismissed };
}

/** חישוב ההצעות למוצרים, לפי המחירים בסניפים שברדיוס של המשתמש */
async function compute(user: number, productIds: number[]): Promise<Map<number, Suggestion>> {
  const result = new Map<number, Suggestion>();
  const { references, candidates, dismissed } = await loadOffers(user, productIds);
  for (const reference of references) {
    const suggestion = suggestAlternative(reference, candidates, dismissed.get(reference.id));
    if (suggestion) result.set(reference.id, suggestion);
  }
  return result;
}

/** המוצרים לא נכללים: אלה שכבר בפריט, ואלה שסומנו "לא דומה" לאחד ממוצרי הפריט */
function excluded(ids: number[], dismissed: Map<number, Set<number>>): Set<number> {
  const set = new Set(ids);
  for (const id of ids) for (const other of dismissed.get(id) ?? []) set.add(other);
  return set;
}

/** מוצרים דומים ומותגים אחרים לפריט ברשימה (כולל מותגי הבית של הרשתות, מארזים וזנים), מהזול ליקר לפי גודל
 * האריזה שברשימה */
export async function similarProducts(item: ListItem, limit = 12): Promise<Related[]> {
  const ids = item.products.map((p) => p.id);
  if (ids.length === 0) return [];
  const { references, candidates, dismissed } = await loadOffers(await uid(), ids, true);
  return relatedProducts(references, candidates, excluded(ids, dismissed), limit);
}

/** כמה מוצרים דומים לכל היותר נכנסים לחישוב הסל לכל פריט */
const BASKET_RELATED_LIMIT = 20;

/** המוצרים הדומים לכל פריט, לחישוב הסל: בגודל דומה, בלי מארזים, זנים ומותגי בית בקוד פנימי. בפריט "כל מותג"
 * הם נכללים תמיד; בפריט רגיל הם חלופה בסניף שאין בו את המותג שנבחר. מפתח: מזהה הפריט. */
export async function basketRelated(items: ListItem[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const wanted = items.filter((item) => item.products.length > 0);
  if (wanted.length === 0) return result;
  const user = await uid();
  const now = Date.now();
  const keyOf = (item: ListItem) => `${user}:a:${item.products.map((p) => p.id).sort((a, b) => a - b).join(",")}`;
  const missing = wanted.filter((item) => {
    const hit = cached<number[]>(keyOf(item), now);
    if (hit) result.set(item.id, hit);
    return hit === undefined;
  });
  if (missing.length === 0) return result;
  const all = [...new Set(missing.flatMap((item) => item.products.map((p) => p.id)))];
  const { references, candidates, dismissed } = await loadOffers(user, all);
  for (const item of missing) {
    const ids = item.products.map((p) => p.id);
    const own = references.filter((r) => ids.includes(r.id));
    const related = relatedProducts(own, candidates, excluded(ids, dismissed), BASKET_RELATED_LIMIT, "basket").map((r) => r.product.id);
    remember(keyOf(item), related, now);
    result.set(item.id, related);
  }
  return result;
}

/** "לא דומה": המוצר לא יוצע שוב כחלופה לאף אחד מהמוצרים האלה */
export async function dismissAlternative(productIds: number[], alternativeId: number): Promise<void> {
  if (productIds.length === 0 || !Number.isInteger(alternativeId)) return;
  const user = await uid();
  await pool.query(
    `INSERT INTO dismissed_alternatives (user_id, product_id, alternative_id)
     SELECT $1, unnest($2::int[]), $3 ON CONFLICT DO NOTHING`,
    [user, productIds, alternativeId],
  );
  forgetSuggestions(user);
}

/** שינוי בכתובות או ב"לא דומה" משנה את ההצעות: מחושבות מחדש */
export function forgetSuggestions(user: number): void {
  for (const key of cache.keys()) if (key.startsWith(`${user}:`)) cache.delete(key);
}
