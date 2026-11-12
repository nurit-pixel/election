import "server-only";
import { pool } from "./db";

export type StorePrice = {
  storePk: number;
  chainName: string;
  storeName: string;
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
  prices: StorePrice[];
};

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

/** חיפוש לפי ברקוד (ספרות בלבד) או לפי כל המילים בשם המוצר. */
export async function searchProducts(query: string, limit = 30): Promise<ProductResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

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
  params.push(STALE_HOURS, limit);
  const staleIdx = params.length - 1;
  const limitIdx = params.length;

  const { rows } = await pool.query(
    `WITH matched AS (
       SELECT p.id, p.barcode, p.internal_chain_id, p.name, p.manufacturer, p.is_weighted,
              (SELECT count(*) FROM prices pr WHERE pr.product_id = p.id) AS store_count
       FROM products p
       WHERE ${where}
       ORDER BY store_count DESC, length(p.name), p.name
       LIMIT $${limitIdx}
     )
     SELECT m.*,
            COALESCE(json_agg(json_build_object(
              'storePk', s.id,
              'chainName', c.name,
              'storeName', COALESCE(s.name, 'סניף ' || s.store_id),
              'price', pr.price,
              'priceUpdatedAt', pr.price_update_time,
              'fileTime', pr.file_time,
              'stale', pr.file_time < now() - make_interval(hours => $${staleIdx})
            ) ORDER BY pr.price, s.name) FILTER (WHERE c.chain_id IS NOT NULL), '[]') AS prices
     FROM matched m
     LEFT JOIN prices pr ON pr.product_id = m.id
     LEFT JOIN stores s ON s.id = pr.store_pk
     LEFT JOIN chains c ON c.chain_id = s.chain_id AND NOT c.hidden
     GROUP BY m.id, m.barcode, m.internal_chain_id, m.name, m.manufacturer, m.is_weighted, m.store_count
     ORDER BY m.store_count DESC, length(m.name), m.name`,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    barcode: r.barcode,
    internal: r.internal_chain_id !== "",
    name: r.name,
    manufacturer: r.manufacturer,
    isWeighted: r.is_weighted,
    prices: r.prices,
  }));
}
