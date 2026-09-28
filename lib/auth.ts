import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ה-cookie חתום ב-HMAC עם OFFICE_CODE / ADMIN_CODE:
// לא אפשר לזייף player_id, והחלפת קוד מנתקת את כולם.
export const PLAYER_COOKIE = "k43_player";
export const ADMIN_COOKIE = "k43_admin";
const NINETY_DAYS = 60 * 60 * 24 * 90;

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkOfficeCode(code: unknown) {
  const expected = process.env.OFFICE_CODE;
  return !!expected && typeof code === "string" && safeEqual(code.trim(), expected);
}

export function checkAdminCode(code: unknown) {
  const expected = process.env.ADMIN_CODE;
  return !!expected && typeof code === "string" && safeEqual(code.trim(), expected);
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: NINETY_DAYS,
};

export async function setPlayerCookie(playerId: string) {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, `${playerId}.${sign(playerId, process.env.OFFICE_CODE!)}`, cookieOpts);
}

export async function getPlayerId(): Promise<string | null> {
  const secret = process.env.OFFICE_CODE;
  if (!secret) return null;
  const raw = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 1) return null;
  const id = raw.slice(0, i);
  return safeEqual(raw.slice(i + 1), sign(id, secret)) ? id : null;
}

export async function clearPlayerCookie() {
  (await cookies()).delete(PLAYER_COOKIE);
}

export async function setAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, sign("admin", process.env.ADMIN_CODE!), { ...cookieOpts, maxAge: 60 * 60 * 24 * 14 });
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_CODE;
  if (!secret) return false;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!raw && safeEqual(raw, sign("admin", secret));
}
