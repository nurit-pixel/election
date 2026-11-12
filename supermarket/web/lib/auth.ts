/** כניסה בסיסמה משפחתית אחת. רץ גם ב-middleware (Edge), ולכן רק Web Crypto. */

export const SESSION_COOKIE = "family_session";

async function hmac(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function familyPassword(): string {
  return process.env.FAMILY_PASSWORD ?? "";
}

/** ערך העוגייה של משתמש מחובר. החלפת הסיסמה (או SESSION_SECRET) מנתקת את כולם. */
export async function sessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET || familyPassword();
  return hmac(secret, `family-session-v1:${familyPassword()}`);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
