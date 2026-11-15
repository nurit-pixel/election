import "server-only";
import { pool } from "./db";
import { chainVisible, storeInRadius } from "./scope";
import { uid } from "./session";

export type StorePrice = {
  storePk: number;
  chainName: string;
  storeName: string;
  city: string | null;
  price: number;
  /** מתי הרשת עדכנה את המחיר */
  priceUpdatedAt: string | null;
  /** חותמת הזמן של קובץ המחירים שממנו נטען המחיר */
  fileTime: string;
  /** הקובץ ישן מ-STALE_PRICE_HOURS שעות */
  stale: boolean;
};

export type ProductResult = {
  id: number;
  barcode: string;
  /** קוד פנימי של רשת – לא ניתן להשוואה בין רשתות */
  internal: boolean;
  name: string;
  manufacturer: string | null;
  isWeighted: boolean;
  /** קוד פנימי: שם הרשת שהמוצר שייך לה */
  chainName: string | null;
  /** הסניפים הזולים באזור (עד PRICES_SHOWN), מהזול ליקר */
  prices: StorePrice[];
  /** בכמה סניפים באזור יש למוצר מחיר */
  storeCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  /** הכמות באריזה ויחידת המידה, למחיר לק״ג/ליטר */
  packQuantity: number | null;
  packUnit: string | null;
};

/** כמה סניפים מוצגים לכל מוצר בתוצאות. השאר בדף המוצר; כך התשובה קטנה ומהירה גם עם הרבה סניפים */
export const PRICES_SHOWN = 8;

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

/** חיפוש לפי ברקוד (ספרות בלבד) או לפי כל המילים בשם המוצר.
 * המחירים מוצגים רק מסניפים שברדיוס הכתובות של המשתמש (אם יש כאלה). */
export async function searchProducts(query: string, limit = 30): Promise<ProductResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const user = await uid();
  const params: unknown[] = [];
  let where: string;
  if (/^\d{4,14}$/.test(q)) {
    params.push(q.replace(/^0+/, ""));
    where = `p.barcode = $1`;
  } else {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
    where = words
      .map((w) => {
        params.push(`%${w.replace(/[\\%_]/g, "\\$&")}%`);
        return `p.name ILIKE $${params.length}`;
      })
      .join(" AND ");
  }
  return runSearch(user, where, params, q, limit);
}

/** המוצרים האלה, באותו מבנה של תוצאות החיפוש ובאותו סדר */
export async function productsByIds(ids: number[]): Promise<ProductResult[]> {
  if (ids.length === 0) return [];
  const results = await runSearch(await uid(), `p.id = ANY($1)`, [ids], "", ids.length);
  const byId = new Map(results.map((r) => [r.id, r]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

async function runSearch(user: number, where: string, params: unknown[], q: string, limit: number): Promise<ProductResult[]> {
  params.push(STALE_HOURS, limit, q);
  const staleIdx = params.length - 2;
  const limitIdx = params.length - 1;
  const qIdx = params.length;
  // התאמה מדויקת לשם קודם, אחריה שם שמתחיל במחרוזת החיפוש, ואז לפי מספר הסניפים
  const rank = (t: string) =>
    `(CASE WHEN ${t}.name = $${qIdx} THEN 0 WHEN ${t}.name ILIKE $${qIdx} || ' %' THEN 1 ELSE 2 END)`;

  const { rows } = await pool.query(
    `WITH matched AS (
       SELECT p.id, p.barcode, p.internal_chain, p.name, p.manufacturer, p.is_weighted, p.quantity, p.unit_qty,
              (SELECT count(*) FROM prices pr WHERE pr.product_id = p.id) AS store_count
       FROM products p
       WHERE ${where}
         AND EXISTS (SELECT 1 FROM prices pr WHERE pr.product_id = p.id)
       ORDER BY ${rank("p")}, store_count DESC, length(p.name), p.name
       LIMIT $${limitIdx}
     ), nearby AS (
       -- הסניפים שברדיוס של המשתמש, פעם אחת, במקום בדיקת מרחק לכל שורת מחיר
       SELECT s.id, s.name, s.store_id, s.city, c.name AS chain_name
       FROM stores s JOIN chains c ON c.key = s.chain_key
       WHERE ${chainVisible(user)} AND ${storeInRadius(user)}
     )
     SELECT m.*, (SELECT name FROM chains WHERE key = m.internal_chain) AS internal_chain_name,
            count(n.id) AS nearby_count, min(pr.price) FILTER (WHERE n.id IS NOT NULL) AS min_price,
            max(pr.price) FILTER (WHERE n.id IS NOT NULL) AS max_price,
            COALESCE(to_json((array_agg(json_build_object(
              'storePk', n.id,
              'chainName', n.chain_name,
              'storeName', COALESCE(n.name, 'סניף ' || n.store_id),
              'city', n.city,
              'price', pr.price,
              'priceUpdatedAt', pr.price_update_time,
              'fileTime', pr.file_time,
              'stale', pr.file_time < now() - make_interval(hours => $${staleIdx})
            ) ORDER BY pr.price, n.name) FILTER (WHERE n.id IS NOT NULL))[1:${PRICES_SHOWN}]), '[]') AS prices
     FROM matched m
     LEFT JOIN prices pr ON pr.product_id = m.id
     LEFT JOIN nearby n ON n.id = pr.store_pk
     GROUP BY m.id, m.barcode, m.internal_chain, m.name, m.manufacturer, m.is_weighted, m.quantity, m.unit_qty, m.store_count
     ORDER BY ${rank("m")}, m.store_count DESC, length(m.name), m.name`,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    barcode: r.barcode,
    internal: r.internal_chain !== "",
    name: r.name,
    manufacturer: r.manufacturer,
    isWeighted: r.is_weighted,
    chainName: r.internal_chain_name,
    prices: r.prices,
    storeCount: Number(r.nearby_count),
    minPrice: r.min_price == null ? null : Number(r.min_price),
    maxPrice: r.max_price == null ? null : Number(r.max_price),
    packQuantity: r.quantity == null ? null : Number(r.quantity),
    packUnit: r.unit_qty ?? null,
  }));
}
