import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// קוד אישי בן 4 ספרות. נשמר כ-scrypt hash עם salt — לא כטקסט.
export const PIN_RE = /^\d{4}$/;
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(pin, salt, 32).toString("base64url");
  return `s1$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const a = scryptSync(pin, salt, 32);
  const b = Buffer.from(hash, "base64url");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** קודים קלים מדי לניחוש — לא מאפשרים לבחור אותם */
export function weakPin(pin: string): boolean {
  return /^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123", "1212", "2580"].includes(pin);
}
