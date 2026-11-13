/** סשן של משתמש מחובר: עוגייה חתומה (HMAC). רץ גם ב-middleware (Edge), ולכן רק Web Crypto. */

export const SESSION_COOKIE = "pm_session";
export const SESSION_DAYS = 180;

async function hmac(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** מפתח החתימה. החלפה שלו מנתקת את כל המכשירים. */
function secret(): string {
  return process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.FAMILY_PASSWORD || "";
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** כניסה זמנית בסיסמה המשפחתית: רק כל עוד הכניסה עם Google לא הוגדרה בשרת. */
export function familyPassword(): string {
  return googleConfigured() ? "" : (process.env.FAMILY_PASSWORD ?? "");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ערך העוגייה של משתמש מחובר: מזהה, מועד תפוגה וחתימה. */
export async function sessionToken(userId: number, now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const body = `${userId}.${expires}`;
  return `${body}.${await hmac(secret(), `session-v2:${body}`)}`;
}

/** מזהה המשתמש מתוך העוגייה, או null אם היא חסרה, פגה או שהחתימה אינה תקינה. */
export async function verifySession(token: string | undefined, now = Date.now()): Promise<number | null> {
  if (!token || !secret()) return null;
  const [id, expires, signature, ...rest] = token.split(".");
  if (!id || !expires || !signature || rest.length > 0) return null;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(expires)) return null;
  if (Number(expires) * 1000 < now) return null;
  const expected = await hmac(secret(), `session-v2:${id}.${expires}`);
  return safeEqual(signature, expected) ? Number(id) : null;
}
