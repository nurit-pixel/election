import "server-only";
import { pool } from "./db";
import { inIsrael, tidyAddress } from "./address";
import { uid } from "./session";

const GEOCODER_URL = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
const USER_AGENT = process.env.GEOCODER_USER_AGENT || "supermarket-basket-compare/0.2";

type Found = { lat: number; lng: number; displayName: string } | null;

/** שאילתה אחת לשירות האיתור. undefined = השירות לא ענה (לא לשמור ב-cache). */
async function fetchLocation(query: string): Promise<Found | undefined> {
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

/** איתור מיידי של כתובת שהמשתמש הוסיף, בלי לחכות לתור של ה-worker.
 * אם השירות לא עונה, הכתובת נשארת "ממתינה" וה-worker יאתר אותה. */
export async function geocodeAddressNow(addressId: number, address: string): Promise<void> {
  const query = tidyAddress(address);
  let found: Found;
  const cached = await pool.query(`SELECT lat, lng FROM geocode_cache WHERE query = $1`, [query]);
  if (cached.rows.length > 0) {
    found = cached.rows[0].lat == null ? null : { lat: cached.rows[0].lat, lng: cached.rows[0].lng, displayName: "" };
  } else {
    const fetched = await fetchLocation(query);
    if (fetched === undefined) return;
    found = fetched;
    await pool.query(
      `INSERT INTO geocode_cache (query, lat, lng, display_name, provider)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (query) DO NOTHING`,
      [query, found?.lat ?? null, found?.lng ?? null, found?.displayName ?? null, GEOCODER_URL],
    );
  }
  await pool.query(
    `UPDATE addresses SET lat = $2, lng = $3, geocoded_at = now(), geocode_error = $4
     WHERE id = $1 AND geocoded_at IS NULL`,
    [addressId, found?.lat ?? null, found?.lng ?? null, found ? null : "הכתובת לא נמצאה"],
  );
}

/** כתובות של המשתמש שעדיין ממתינות לאיתור (למשל כי ה-worker עסוק): מאתרים אותן עכשיו. */
export async function geocodePendingAddresses(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, address FROM addresses WHERE user_id = $1 AND geocoded_at IS NULL ORDER BY id LIMIT 3`,
    [await uid()],
  );
  for (const row of rows) await geocodeAddressNow(row.id, row.address);
}
