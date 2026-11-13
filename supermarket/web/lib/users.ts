import "server-only";
import { pool } from "./db";

export type User = { id: number; email: string; name: string | null };

/** המזהה של החשבון הזמני שמשמש את הכניסה בסיסמה המשפחתית, עד שמוגדרת כניסה עם Google */
const FAMILY_SUB = "family";

export const signInFamilyUser = () => signInGoogleUser({ sub: FAMILY_SUB, email: "", name: "החשבון המשפחתי" });

/** כתובות מייל שמורשות להיכנס (ALLOWED_EMAILS, מופרדות בפסיק). ריק = כל חשבון Google. */
export function emailAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

/** כניסה של חשבון Google: יוצר את המשתמש בפעם הראשונה ומחזיר את המזהה שלו.
 * המשתמש הראשון במערכת מקבל את כל הנתונים שנוצרו לפני הכניסה עם Google. */
export async function signInGoogleUser(profile: { sub: string; email: string; name: string | null }): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const existing = await client.query(
      `UPDATE users SET email = $2, name = $3, last_login = now() WHERE google_sub = $1 RETURNING id`,
      [profile.sub, profile.email, profile.name],
    );
    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return existing.rows[0].id;
    }
    // החשבון הזמני של הכניסה בסיסמה עובר, עם כל הנתונים שלו, לחשבון ה-Google הראשון שנכנס
    const adopted = await client.query(
      `UPDATE users SET google_sub = $1, email = $2, name = $3, last_login = now()
       WHERE google_sub = $4 RETURNING id`,
      [profile.sub, profile.email, profile.name, FAMILY_SUB],
    );
    if (adopted.rows.length > 0) {
      await client.query("COMMIT");
      return adopted.rows[0].id;
    }
    const first = (await client.query(`SELECT 1 FROM users LIMIT 1`)).rows.length === 0;
    const { rows } = await client.query(
      `INSERT INTO users (google_sub, email, name) VALUES ($1, $2, $3) RETURNING id`,
      [profile.sub, profile.email, profile.name],
    );
    const id: number = rows[0].id;
    if (first) {
      for (const table of ["lists", "addresses", "tracked_products", "alerts"]) {
        await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [id]);
      }
      await client.query(
        `INSERT INTO user_clubs (user_id, chain_key, club_id)
         SELECT $1, chain_key, club_id FROM clubs WHERE member ON CONFLICT DO NOTHING`,
        [id],
      );
      await client.query(
        `INSERT INTO user_hidden_chains (user_id, chain_key)
         SELECT $1, key FROM chains WHERE hidden ON CONFLICT DO NOTHING`,
        [id],
      );
      await client.query(
        `INSERT INTO user_settings (user_id, key, value)
         SELECT $1, key, value FROM app_settings WHERE key = 'split_min_saving' ON CONFLICT DO NOTHING`,
        [id],
      );
    }
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getUser(id: number): Promise<User | null> {
  const { rows } = await pool.query(`SELECT id, email, name FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
