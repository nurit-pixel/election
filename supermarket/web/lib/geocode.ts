import "server-only";
import { pool } from "./db";
import { addressQueries, houseNumberMatched, inIsrael, shortPlaceName, tidyAddress } from "./address";
import { uid } from "./session";

const GEOCODER_URL = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
const USER_AGENT = process.env.GEOCODER_USER_AGENT || "supermarket-basket-compare/0.2";

type Found = { lat: number; lng: number; displayName: string };

export type Location =
  | { status: "found"; lat: number; lng: number; name: string; /** זוהו רק הרחוב או רק העיר */ approximate: boolean }
  | { status: "notfound" }
  /** שירות האיתור לא ענה; ה-worker ינסה שוב */
  | { status: "unavailable" };

/** שאילתה אחת לשירות האיתור. undefined = השירות לא ענה (לא לשמור ב-cache). */
async function fetchLocation(query: string): Promise<Found | null | undefined> {
  try {
    const url = new URL(GEOCODER_URL);
    for (const [key, value] of Object.entries({ q: query, format: "jsonv2", limit: "1", countrycodes: "il", "accept-language": "he" })) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const results = (await response.json()) as { lat: string; lon: string; display_name?: string }[];
    if (results.length === 0) return null;
    const lat = Number(results[0].lat);
    const lng = Number(results[0].lon);
    return inIsrael(lat, lng) ? { lat, lng, displayName: results[0].display_name ?? "" } : null;
  } catch {
    return undefined;
  }
}

/** תוצאה לשאילתה אחת, דרך ה-cache המשותף עם ה-ingest (גם "לא נמצא" נשמר). */
async function lookup(query: string): Promise<Found | null | undefined> {
  const cached = await pool.query(`SELECT lat, lng, display_name FROM geocode_cache WHERE query = $1`, [query]);
  if (cached.rows.length > 0) {
    const row = cached.rows[0];
    return row.lat == null ? null : { lat: row.lat, lng: row.lng, displayName: row.display_name ?? "" };
  }
  const fetched = await fetchLocation(query);
  if (fetched === undefined) return undefined;
  await pool.query(
    `INSERT INTO geocode_cache (query, lat, lng, display_name, provider)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (query) DO NOTHING`,
    [query, fetched?.lat ?? null, fetched?.lng ?? null, fetched?.displayName ?? null, GEOCODER_URL],
  );
  return fetched;
}

/** איתור כתובת: הכתובת המלאה, ואם לא נמצאה – הרחוב בלי המספר, ואז העיר. */
export async function locateAddress(address: string): Promise<Location> {
  let unavailable = false;
  for (const { query, level } of addressQueries(address)) {
    const found = await lookup(query);
    if (found === undefined) {
      unavailable = true;
      break;
    }
    if (found) {
      return {
        status: "found",
        lat: found.lat,
        lng: found.lng,
        name: shortPlaceName(found.displayName) || tidyAddress(address),
        approximate: level !== "exact" || !houseNumberMatched(address, found.displayName),
      };
    }
  }
  return { status: unavailable ? "unavailable" : "notfound" };
}

/** שמירת תוצאת האיתור לכתובת שעדיין ממתינה. */
async function saveLocation(addressId: number, location: Location): Promise<void> {
  if (location.status === "unavailable") return;
  const found = location.status === "found" ? location : null;
  await pool.query(
    `UPDATE addresses SET lat = $2, lng = $3, located_name = $4, approximate = $5,
            geocoded_at = now(), geocode_error = $6
     WHERE id = $1 AND geocoded_at IS NULL`,
    [addressId, found?.lat ?? null, found?.lng ?? null, found?.name ?? null, found?.approximate ?? false,
     found ? null : "הכתובת לא נמצאה"],
  );
}

/** כתובות של המשתמש שעדיין ממתינות לאיתור (למשל כי שירות האיתור לא ענה): מאתרים אותן עכשיו. */
export async function geocodePendingAddresses(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, address FROM addresses WHERE user_id = $1 AND geocoded_at IS NULL ORDER BY id LIMIT 3`,
    [await uid()],
  );
  for (const row of rows) await saveLocation(row.id, await locateAddress(row.address));
}
