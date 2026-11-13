import "server-only";

/** קטעי SQL שמגבילים שאילתה לנתונים של משתמש אחד. המזהה מגיע מהסשן החתום והוא תמיד מספר שלם. */

function id(user: number): number {
  if (!Number.isInteger(user) || user <= 0) throw new Error("invalid user id");
  return user;
}

/** הכתובות של המשתמש שמוקמו על המפה, בכינוי a */
export const userAddresses = (user: number) =>
  `(SELECT * FROM addresses WHERE user_id = ${id(user)} AND lat IS NOT NULL) a`;

/** הרשת (c) לא הוסתרה על ידי המשתמש */
export const chainVisible = (user: number) =>
  `NOT EXISTS (SELECT 1 FROM user_hidden_chains h WHERE h.user_id = ${id(user)} AND h.chain_key = c.key)`;

/** הסניף (s) ברדיוס של אחת מכתובות המשתמש; למשתמש בלי כתובות, כל הסניפים */
export const storeInRadius = (user: number) => `(
    NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = ${id(user)} AND lat IS NOT NULL)
    OR EXISTS (SELECT 1 FROM ${userAddresses(user)} WHERE s.lat IS NOT NULL
               AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km))`;
