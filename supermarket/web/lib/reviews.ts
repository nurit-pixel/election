import "server-only";
import { pool } from "./db";
import { uid } from "./session";

export const MAX_COMMENT = 300;

export type Review = {
  id: number;
  rating: number;
  comment: string | null;
  /** השם הפרטי של הכותב/ת, או "משתמש/ת" */
  author: string;
  mine: boolean;
  updatedAt: string;
};

export type StoreReviews = { average: number | null; count: number; mine: Review | null; recent: Review[] };

/** שם תצוגה לחוות דעת: רק השם הפרטי, בלי מייל */
export function firstName(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first && !first.includes("@") ? first.slice(0, 20) : "משתמש/ת";
}

export async function storeReviews(storePk: number, limit = 20): Promise<StoreReviews> {
  const user = await uid();
  const [summary, rows] = await Promise.all([
    pool.query(`SELECT avg(rating) AS average, count(*) AS count FROM store_reviews WHERE store_pk = $1`, [storePk]),
    pool.query(
      `SELECT r.id, r.rating, r.comment, r.updated_at, u.name, r.user_id = $2 AS mine
       FROM store_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.store_pk = $1
       ORDER BY (r.user_id = $2) DESC, (r.comment IS NOT NULL) DESC, r.updated_at DESC
       LIMIT $3`,
      [storePk, user, limit],
    ),
  ]);
  const recent: Review[] = rows.rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    author: firstName(r.name),
    mine: r.mine,
    updatedAt: r.updated_at,
  }));
  const count = Number(summary.rows[0].count);
  return {
    average: count > 0 ? Math.round(Number(summary.rows[0].average) * 10) / 10 : null,
    count,
    mine: recent.find((r) => r.mine) ?? null,
    recent: recent.filter((r) => !r.mine),
  };
}

/** שמירת חוות הדעת של המשתמש על סניף (חדשה, או עדכון של הקיימת). */
export async function saveReview(storePk: number, rating: number, comment: string): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const text = comment.replace(/\s+/g, " ").trim().slice(0, MAX_COMMENT) || null;
  await pool.query(
    `INSERT INTO store_reviews (user_id, store_pk, rating, comment)
     SELECT $1, id, $3, $4 FROM stores WHERE id = $2
     ON CONFLICT (user_id, store_pk) DO UPDATE
       SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()`,
    [await uid(), storePk, rating, text],
  );
}

export async function deleteMyReview(storePk: number): Promise<void> {
  await pool.query(`DELETE FROM store_reviews WHERE user_id = $1 AND store_pk = $2`, [await uid(), storePk]);
}
