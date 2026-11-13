import "server-only";
import { pool } from "./db";
import { enqueue } from "./settings";

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

/** סינון לסניפים שברדיוס הכתובות השמורות (אם יש כתובות) ולרשתות שאינן מוסתרות */
const IN_RADIUS = `
  NOT c.hidden AND (
    NOT EXISTS (SELECT 1 FROM addresses WHERE lat IS NOT NULL)
    OR EXISTS (SELECT 1 FROM addresses a WHERE a.lat IS NOT NULL AND s.lat IS NOT NULL
               AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km))`;

export type ProductStorePrice = {
  storePk: number;
  chainName: string;
  storeName: string;
  price: number;
  fileTime: string;
  stale: boolean;
};

export type HistoryPoint = { day: string; price: number };

export type ProductDetails = {
  id: number;
  barcode: string;
  name: string;
  manufacturer: string | null;
  isWeighted: boolean;
  /** קוד פנימי: שם הרשת היחידה שבה המוצר קיים */
  chainName: string | null;
  tracked: boolean;
  targetPrice: number | null;
  inLists: string[];
  prices: ProductStorePrice[];
  /** המחיר הזול ביותר בסניפים שברדיוס, לכל יום */
  history: HistoryPoint[];
  /** המחיר הזול בכל רשת, לכל יום (לטבלה) */
  historyByChain: { chainName: string; points: HistoryPoint[] }[];
};

export async function getProduct(id: number): Promise<ProductDetails | null> {
  const product = await pool.query(
    `SELECT p.id, p.barcode, p.name, p.manufacturer, p.is_weighted,
            (SELECT name FROM chains WHERE key = p.internal_chain) AS chain_name,
            t.product_id IS NOT NULL AS tracked, t.target_price,
            ARRAY(SELECT DISTINCT l.name FROM list_item_products ip
                  JOIN list_items i ON i.id = ip.item_id JOIN lists l ON l.id = i.list_id
                  WHERE ip.product_id = p.id) AS in_lists
     FROM products p LEFT JOIN tracked_products t ON t.product_id = p.id
     WHERE p.id = $1`,
    [id],
  );
  if (product.rows.length === 0) return null;
  const [prices, history] = await Promise.all([
    pool.query(
      `SELECT s.id AS store_pk, c.name AS chain_name, COALESCE(s.name, 'סניף ' || s.store_id) AS store_name,
              pr.price, pr.file_time, pr.file_time < now() - make_interval(hours => $2) AS stale
       FROM prices pr JOIN stores s ON s.id = pr.store_pk JOIN chains c ON c.key = s.chain_key
       WHERE pr.product_id = $1 AND ${IN_RADIUS}
       ORDER BY pr.price, c.sort_order, s.name`,
      [id, STALE_HOURS],
    ),
    // לכל יום ולכל סניף: המחיר האחרון הידוע עד אותו יום (עד שבוע אחורה), כך שסניף
    // שלא עודכן ביום מסוים לא יוצר קפיצה מדומה בגרף
    pool.query(
      `WITH days AS (SELECT DISTINCT day FROM price_history WHERE product_id = $1),
            shops AS (SELECT DISTINCT h.store_pk FROM price_history h WHERE h.product_id = $1)
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day, c.name AS chain_name, c.sort_order, min(last.price) AS price
       FROM days d
       CROSS JOIN shops
       JOIN stores s ON s.id = shops.store_pk
       JOIN chains c ON c.key = s.chain_key
       JOIN LATERAL (
         SELECT h.price FROM price_history h
         WHERE h.product_id = $1 AND h.store_pk = s.id AND h.day <= d.day AND h.day >= d.day - 7
         ORDER BY h.day DESC LIMIT 1
       ) last ON true
       WHERE ${IN_RADIUS}
       GROUP BY d.day, c.name, c.sort_order ORDER BY d.day, c.sort_order`,
      [id],
    ),
  ]);

  const byDay = new Map<string, number>();
  const byChain = new Map<string, HistoryPoint[]>();
  for (const r of history.rows) {
    const price = Number(r.price);
    byDay.set(r.day, Math.min(byDay.get(r.day) ?? Infinity, price));
    byChain.set(r.chain_name, [...(byChain.get(r.chain_name) ?? []), { day: r.day, price }]);
  }
  const p = product.rows[0];
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    manufacturer: p.manufacturer,
    isWeighted: p.is_weighted,
    chainName: p.chain_name,
    tracked: p.tracked,
    targetPrice: p.target_price == null ? null : Number(p.target_price),
    inLists: p.in_lists,
    prices: prices.rows.map((r) => ({
      storePk: r.store_pk,
      chainName: r.chain_name,
      storeName: r.store_name,
      price: Number(r.price),
      fileTime: new Date(r.file_time).toISOString(),
      stale: r.stale,
    })),
    history: [...byDay.entries()].map(([day, price]) => ({ day, price })),
    historyByChain: [...byChain.entries()].map(([chainName, points]) => ({ chainName, points })),
  };
}

/** הוספה למעקב (או עדכון מחיר היעד). המחיר הנוכחי נשמר מיד בהיסטוריה. */
export async function trackProduct(productId: number, targetPrice: number | null): Promise<void> {
  await pool.query(
    `INSERT INTO tracked_products (product_id, target_price) VALUES ($1, $2)
     ON CONFLICT (product_id) DO UPDATE SET target_price = EXCLUDED.target_price`,
    [productId, targetPrice],
  );
  await enqueue("track");
}

export async function untrackProduct(productId: number): Promise<void> {
  await pool.query(`DELETE FROM tracked_products WHERE product_id = $1`, [productId]);
}

export type TrackedProduct = {
  id: number;
  name: string;
  isWeighted: boolean;
  targetPrice: number | null;
  /** המחיר הזול כרגע בסניפים שברדיוס */
  bestPrice: number | null;
};

export async function listTracked(limit = 200): Promise<{ products: TrackedProduct[]; total: number }> {
  const [rows, total] = await Promise.all([
    pool.query(
      `SELECT p.id, p.name, p.is_weighted, t.target_price,
              (SELECT min(pr.price) FROM prices pr JOIN stores s ON s.id = pr.store_pk
                 JOIN chains c ON c.key = s.chain_key
                WHERE pr.product_id = p.id AND ${IN_RADIUS}) AS best_price
       FROM tracked_products t JOIN products p ON p.id = t.product_id
       ORDER BY (t.target_price IS NULL), t.created_at DESC, p.name LIMIT $1`,
      [limit],
    ),
    pool.query(`SELECT count(*) FROM tracked_products`),
  ]);
  return {
    total: Number(total.rows[0].count),
    products: rows.rows.map((r) => ({
      id: r.id,
      name: r.name,
      isWeighted: r.is_weighted,
      targetPrice: r.target_price == null ? null : Number(r.target_price),
      bestPrice: r.best_price == null ? null : Number(r.best_price),
    })),
  };
}

export type AlertRow = {
  id: number;
  productId: number;
  productName: string;
  chainName: string;
  storeName: string | null;
  kind: "change" | "target";
  day: string;
  oldPrice: number | null;
  newPrice: number;
  pct: number | null;
  targetPrice: number | null;
  read: boolean;
};

export async function listAlerts(limit = 200): Promise<AlertRow[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.product_id, p.name AS product_name, c.name AS chain_name, s.name AS store_name,
            a.kind, to_char(a.day, 'YYYY-MM-DD') AS day, a.old_price, a.new_price, a.pct,
            a.target_price, a.read_at IS NOT NULL AS read
     FROM alerts a
     JOIN products p ON p.id = a.product_id
     JOIN chains c ON c.key = a.chain_key
     LEFT JOIN stores s ON s.id = a.store_pk
     ORDER BY a.day DESC, (a.kind = 'target') DESC, a.pct NULLS LAST, p.name
     LIMIT $1`,
    [limit],
  );
  const num = (v: unknown) => (v == null ? null : Number(v));
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    chainName: r.chain_name,
    storeName: r.store_name,
    kind: r.kind,
    day: r.day,
    oldPrice: num(r.old_price),
    newPrice: Number(r.new_price),
    pct: num(r.pct),
    targetPrice: num(r.target_price),
    read: r.read,
  }));
}

export async function unreadAlertCount(): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT count(*) FROM alerts WHERE read_at IS NULL`);
    return Number(rows[0].count);
  } catch {
    return 0; // המסד עוד לא מוכן (הפעלה ראשונה)
  }
}

export async function markAlertsRead(): Promise<void> {
  await pool.query(`UPDATE alerts SET read_at = now() WHERE read_at IS NULL`);
}
