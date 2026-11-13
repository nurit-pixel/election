import "server-only";

/** כניסה עם Google (OAuth 2.0, authorization code). בלי ספרייה חיצונית. */

// אפשר להפנות לשרת אחר לצורך בדיקות אוטומטיות
const AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const STATE_COOKIE = "pm_oauth_state";

/** כתובת הבסיס של האפליקציה כפי שהדפדפן רואה אותה (APP_URL, או לפי כותרות ה-proxy). */
export function appOrigin(headers: Headers): string {
  const configured = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (configured) return configured;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  return `${headers.get("x-forwarded-proto") ?? "http"}://${host}`;
}

export const redirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function authorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export type GoogleProfile = { sub: string; email: string; name: string | null };

/** החלפת הקוד שחזר מ-Google בפרטי החשבון. מחזיר null אם Google דחה או שהפרטים אינם תקינים. */
export async function exchangeCode(code: string, origin: string): Promise<GoogleProfile | null> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("google: token exchange failed", response.status);
    return null;
  }
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  // ה-id_token התקבל ישירות מ-Google בחיבור מוצפן, ולכן מספיק לבדוק את התוכן שלו
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const valid =
    claims.aud === process.env.GOOGLE_CLIENT_ID &&
    ISSUERS.includes(String(claims.iss)) &&
    Number(claims.exp) * 1000 > Date.now() &&
    typeof claims.sub === "string" &&
    typeof claims.email === "string" &&
    claims.email_verified !== false &&
    claims.email_verified !== "false";
  if (!valid) {
    console.error("google: id token rejected");
    return null;
  }
  return {
    sub: claims.sub as string,
    email: claims.email as string,
    name: typeof claims.name === "string" ? claims.name : null,
  };
}
