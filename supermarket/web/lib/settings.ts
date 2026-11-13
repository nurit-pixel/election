import "server-only";
import { pool } from "./db";
import { uid } from "./session";

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

export type Address = {
  id: number;
  label: string;
  address: string;
  radiusKm: number;
  /** pending = ממתין ל-geocoding, ok = נמצא, failed = לא נמצא */
  state: "pending" | "ok" | "failed";
  storesInRadius: number;
  storesWithPrices: number;
  /** סניפים שמוקמו רק לפי העיר ולא לפי הכתובת */
  storesApproximate: number;
  /** המקום שזוהה לכתובת */
  locatedName: string | null;
  /** זוהו רק הרחוב או רק העיר, לא הכתובת המדויקת */
  approximate: boolean;
};

export async function listAddresses(): Promise<Address[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.label, a.address, a.radius_km, a.located_name, a.approximate,
            CASE WHEN a.geocoded_at IS NULL THEN 'pending'
                 WHEN a.lat IS NULL THEN 'failed' ELSE 'ok' END AS state,
            count(s.id) AS in_radius,
            count(s.id) FILTER (WHERE s.prices_file_time IS NOT NULL) AS with_prices,
            count(s.id) FILTER (WHERE s.geocode_precision = 'city') AS stores_approximate
     FROM addresses a
     LEFT JOIN stores s
       ON a.lat IS NOT NULL AND s.lat IS NOT NULL
      AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km
     WHERE a.user_id = $1
     GROUP BY a.id ORDER BY a.id`,
    [await uid()],
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    address: r.address,
    radiusKm: Number(r.radius_km),
    state: r.state,
    storesInRadius: Number(r.in_radius),
    storesWithPrices: Number(r.with_prices),
    storesApproximate: Number(r.stores_approximate),
    locatedName: r.located_name,
    approximate: r.approximate === true,
  }));
}

export type RunInfo = {
  status: "running" | "ok" | "partial" | "failed";
  startedAt: string;
  filesLoaded: number;
  filesFailed: number;
  error: string | null;
};

export type ChainStatus = {
  key: string;
  name: string;
  isPharm: boolean;
  hidden: boolean;
  stores: number;
  geocoded: number;
  storesWithPrices: number;
  /** קובץ המחירים הישן ביותר מבין הסניפים שנטענו */
  oldestPrices: string | null;
  /** יש מחירים, אבל הם ישנים או שהטעינה האחרונה נכשלה */
  notUpdated: boolean;
  storesRun: RunInfo | null;
  pricesRun: RunInfo | null;
  promosRun: RunInfo | null;
};

export async function chainStatuses(): Promise<ChainStatus[]> {
  const { rows } = await pool.query(
    `SELECT c.key, c.name, c.is_pharm,
            EXISTS (SELECT 1 FROM user_hidden_chains h WHERE h.user_id = $2 AND h.chain_key = c.key) AS hidden,
            (SELECT count(*) FROM stores s WHERE s.chain_key = c.key) AS stores,
            (SELECT count(*) FROM stores s WHERE s.chain_key = c.key AND s.lat IS NOT NULL) AS geocoded,
            (SELECT count(*) FROM stores s WHERE s.chain_key = c.key
               AND s.prices_file_time IS NOT NULL) AS with_prices,
            (SELECT min(s.prices_file_time) FROM stores s WHERE s.chain_key = c.key) AS oldest_prices,
            (SELECT min(s.prices_file_time) < now() - make_interval(hours => $1)
               FROM stores s WHERE s.chain_key = c.key) AS stale,
            (SELECT row_to_json(r) FROM (
               SELECT status, started_at, files_loaded, files_failed, error FROM ingest_runs
               WHERE chain_key = c.key AND kind = 'stores' ORDER BY id DESC LIMIT 1) r) AS stores_run,
            (SELECT row_to_json(r) FROM (
               SELECT status, started_at, files_loaded, files_failed, error FROM ingest_runs
               WHERE chain_key = c.key AND kind = 'prices' ORDER BY id DESC LIMIT 1) r) AS prices_run,
            (SELECT row_to_json(r) FROM (
               SELECT status, started_at, files_loaded, files_failed, error FROM ingest_runs
               WHERE chain_key = c.key AND kind = 'promos' ORDER BY id DESC LIMIT 1) r) AS promos_run
     FROM chains c ORDER BY c.sort_order`,
    [STALE_HOURS, await uid()],
  );
  const run = (r: Record<string, unknown> | null): RunInfo | null =>
    r && {
      status: r.status as RunInfo["status"],
      startedAt: r.started_at as string,
      filesLoaded: r.files_loaded as number,
      filesFailed: r.files_failed as number,
      error: (r.error as string | null) ?? null,
    };
  return rows.map((r) => {
    const pricesRun = run(r.prices_run);
    return {
      key: r.key,
      name: r.name,
      isPharm: r.is_pharm,
      hidden: r.hidden,
      stores: Number(r.stores),
      geocoded: Number(r.geocoded),
      storesWithPrices: Number(r.with_prices),
      oldestPrices: r.oldest_prices,
      notUpdated:
        Number(r.with_prices) > 0 && (r.stale === true || pricesRun?.status === "failed"),
      storesRun: run(r.stores_run),
      pricesRun,
      promosRun: run(r.promos_run),
    };
  });
}

export type Overview = {
  stores: number;
  geocoded: number;
  geocodePending: number;
  activeRequests: { kind: string; status: string; message: string | null }[];
  /** הריצה הלילית האחרונה */
  nightly: { status: string; startedAt: string | null; message: string | null } | null;
  nightlyTime: string;
};

export async function overview(): Promise<Overview> {
  const [stores, requests, nightly] = await Promise.all([
    pool.query(
      `SELECT count(*) AS stores, count(lat) AS geocoded,
              count(*) FILTER (WHERE geocoded_at IS NULL) AS pending FROM stores`,
    ),
    pool.query(
      `SELECT kind, status, message FROM ingest_requests
       WHERE status IN ('pending', 'running') ORDER BY (status = 'running') DESC, id`,
    ),
    pool.query(
      `SELECT status, started_at, message FROM ingest_requests
       WHERE kind = 'nightly' ORDER BY id DESC LIMIT 1`,
    ),
  ]);
  return {
    stores: Number(stores.rows[0].stores),
    geocoded: Number(stores.rows[0].geocoded),
    geocodePending: Number(stores.rows[0].pending),
    activeRequests: requests.rows,
    nightly: nightly.rows[0]
      ? { status: nightly.rows[0].status, startedAt: nightly.rows[0].started_at, message: nightly.rows[0].message }
      : null,
    nightlyTime: process.env.NIGHTLY_TIME ?? "06:00",
  };
}

/** בקשה ל-worker של ה-ingest. בקשה זהה שכבר ממתינה לא נוצרת שוב. */
export async function enqueue(kind: "address" | "stores" | "prices" | "track", addressId: number | null = null) {
  await pool.query(
    `INSERT INTO ingest_requests (kind, address_id)
     SELECT $1, $2 WHERE NOT EXISTS (
       SELECT 1 FROM ingest_requests
       WHERE kind = $1 AND address_id IS NOT DISTINCT FROM $2 AND status = 'pending')`,
    [kind, addressId],
  );
  await pool.query("NOTIFY ingest");
}

export type Club = { chainKey: string; chainName: string; clubId: number; name: string; member: boolean };

/** מועדוני הלקוחות שנמצאו בקבצי המבצעים, לפי רשת. */
export async function listClubs(): Promise<Club[]> {
  const { rows } = await pool.query(
    `SELECT cl.chain_key, c.name AS chain_name, cl.club_id, cl.name,
            EXISTS (SELECT 1 FROM user_clubs u WHERE u.user_id = $1 AND u.chain_key = cl.chain_key
                    AND u.club_id = cl.club_id) AS member
     FROM clubs cl JOIN chains c ON c.key = cl.chain_key
     ORDER BY c.sort_order, cl.club_id`,
    [await uid()],
  );
  return rows.map((r) => ({
    chainKey: r.chain_key,
    chainName: r.chain_name,
    clubId: r.club_id,
    name: r.name,
    member: r.member,
  }));
}

const DEFAULT_SPLIT_MIN_SAVING = Number(process.env.SPLIT_MIN_SAVING ?? 20);

/** סף החיסכון (בש"ח) שמעליו מוצג למשתמש פיצול לשני סניפים. */
export async function splitMinSaving(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT value FROM user_settings WHERE user_id = $1 AND key = 'split_min_saving'`,
    [await uid()],
  );
  const value = rows.length > 0 ? Number(rows[0].value) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SPLIT_MIN_SAVING;
}

export async function setSplitMinSaving(value: number): Promise<void> {
  await pool.query(
    `INSERT INTO user_settings (user_id, key, value) VALUES ($1, 'split_min_saving', $2)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [await uid(), String(value)],
  );
}

export async function setChainHidden(chainKey: string, hidden: boolean): Promise<void> {
  const user = await uid();
  if (hidden) {
    await pool.query(
      `INSERT INTO user_hidden_chains (user_id, chain_key)
       SELECT $1, key FROM chains WHERE key = $2 ON CONFLICT DO NOTHING`,
      [user, chainKey],
    );
  } else {
    await pool.query(`DELETE FROM user_hidden_chains WHERE user_id = $1 AND chain_key = $2`, [user, chainKey]);
  }
}

export async function setClubMember(chainKey: string, clubId: number, member: boolean): Promise<void> {
  const user = await uid();
  if (member) {
    await pool.query(
      `INSERT INTO user_clubs (user_id, chain_key, club_id)
       SELECT $1, chain_key, club_id FROM clubs WHERE chain_key = $2 AND club_id = $3 ON CONFLICT DO NOTHING`,
      [user, chainKey, clubId],
    );
  } else {
    await pool.query(`DELETE FROM user_clubs WHERE user_id = $1 AND chain_key = $2 AND club_id = $3`, [
      user,
      chainKey,
      clubId,
    ]);
  }
}

export const MAX_ADDRESSES = Number(process.env.MAX_ADDRESSES_PER_USER ?? 3);

type Place = { lat: number; lng: number; name: string; approximate: boolean };

/** כתובת חדשה למשתמש. place = המקום שכבר אותר; null = ממתינה לאיתור על ידי ה-worker.
 * מחזיר את המזהה, או null אם הגיע למספר הכתובות המרבי. */
export async function addUserAddress(
  label: string,
  address: string,
  radiusKm: number,
  place: Place | null,
): Promise<number | null> {
  const { rows } = await pool.query(
    `INSERT INTO addresses (label, address, radius_km, user_id, lat, lng, located_name, approximate, geocoded_at)
     SELECT $1, $2, $3, $4, $6, $7, $8, $9, CASE WHEN $6::float8 IS NULL THEN NULL ELSE now() END
     WHERE (SELECT count(*) FROM addresses WHERE user_id = $4) < $5
     RETURNING id`,
    [label, address, radiusKm, await uid(), MAX_ADDRESSES, place?.lat ?? null, place?.lng ?? null,
     place?.name ?? null, place?.approximate ?? false],
  );
  return rows[0]?.id ?? null;
}

/** תיקון הטקסט של כתובת קיימת, עם המקום החדש שאותר. מחזיר האם הכתובת שייכת למשתמש. */
export async function updateUserAddress(id: number, address: string, place: Place): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE addresses
     SET label = CASE WHEN label = address THEN $2 ELSE label END, address = $2,
         lat = $4, lng = $5, located_name = $6, approximate = $7, geocoded_at = now(), geocode_error = NULL
     WHERE id = $1 AND user_id = $3`,
    [id, address, await uid(), place.lat, place.lng, place.name, place.approximate],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteUserAddress(id: number): Promise<void> {
  await pool.query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [id, await uid()]);
}

/** עדכון רדיוס; מחזיר האם הכתובת שייכת למשתמש. */
export async function setAddressRadius(id: number, radiusKm: number): Promise<boolean> {
  const { rowCount } = await pool.query(`UPDATE addresses SET radius_km = $2 WHERE id = $1 AND user_id = $3`, [
    id,
    radiusKm,
    await uid(),
  ]);
  return (rowCount ?? 0) > 0;
}

/** האם למשתמש יש כתובת שמורה (בלי כתובת אין סניפים להשוות) */
export async function hasAddress(): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM addresses WHERE user_id = $1 LIMIT 1`, [await uid()]);
  return rows.length > 0;
}
