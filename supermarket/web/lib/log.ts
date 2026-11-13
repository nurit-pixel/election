import "server-only";
import { pool } from "./db";

/** רישום אירוע ליומן של מסך הניהול. כשל ברישום לא מפיל את הבקשה. */
export async function logEvent(
  level: "info" | "error",
  kind: string,
  message: string,
  extra: { userId?: number | null; details?: string | null } = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO app_log (level, kind, user_id, message, details) VALUES ($1, $2, $3, $4, $5)`,
      [level, kind, extra.userId ?? null, message.slice(0, 500), extra.details?.slice(0, 2000) ?? null],
    );
  } catch (error) {
    console.error("log: could not record event", kind, error);
  }
}
