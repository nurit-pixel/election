import "server-only";
import { generateKeyPairSync } from "node:crypto";
import { pool } from "./db";
import { uid } from "./session";

/** מפתחות ה-VAPID של השרת: נוצרים בפעם הראשונה ונשמרים במסד (app_settings), שם גם ה-ingest קורא אותם. */
export async function vapidPublicKey(): Promise<string> {
  const existing = await pool.query(`SELECT value FROM app_settings WHERE key = 'vapid_public'`);
  if (existing.rows.length > 0) return existing.rows[0].value;
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  // מפתח ציבורי לא דחוס (0x04 || x || y) ומפתח פרטי גולמי (d), שניהם base64url
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]);
  const subject = process.env.APP_URL?.startsWith("https://") ? process.env.APP_URL : "mailto:admin@localhost";
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('vapid_public', $1), ('vapid_private', $2), ('vapid_subject', $3)
     ON CONFLICT (key) DO NOTHING`,
    [raw.toString("base64url"), priv.d!, subject],
  );
  // אם שתי בקשות יצרו מפתחות במקביל, נשאר הראשון שנשמר
  const saved = await pool.query(`SELECT value FROM app_settings WHERE key = 'vapid_public'`);
  return saved.rows[0].value;
}

export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export function validSubscription(value: unknown): value is Subscription {
  const s = value as Subscription;
  return (
    typeof s?.endpoint === "string" &&
    /^https:\/\//.test(s.endpoint) &&
    s.endpoint.length < 1000 &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string" &&
    s.keys.p256dh.length < 200 &&
    s.keys.auth.length < 100
  );
}

export async function saveSubscription(subscription: Subscription): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [await uid(), subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
  );
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, await uid()]);
}
