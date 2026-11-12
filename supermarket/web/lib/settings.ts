import "server-only";
import { pool } from "./db";

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
};

export async function listAddresses(): Promise<Address[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.label, a.address, a.radius_km,
            CASE WHEN a.geocoded_at IS NULL THEN 'pending'
                 WHEN a.lat IS NULL THEN 'failed' ELSE 'ok' END AS state,
            count(s.id) AS in_radius,
            count(s.id) FILTER (WHERE s.prices_file_time IS NOT NULL) AS with_prices,
            count(s.id) FILTER (WHERE s.geocode_precision = 'city') AS approximate
     FROM addresses a
     LEFT JOIN stores s
       ON a.lat IS NOT NULL AND s.lat IS NOT NULL
      AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km
     GROUP BY a.id ORDER BY a.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    address: r.address,
    radiusKm: Number(r.radius_km),
    state: r.state,
    storesInRadius: Number(r.in_radius),
    storesWithPrices: Number(r.with_prices),
    storesApproximate: Number(r.approximate),
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
    `SELECT c.key, c.name, c.is_pharm, c.hidden,
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
    [STALE_HOURS],
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
  activeRequests: { kind: string; status: string }[];
};

export async function overview(): Promise<Overview> {
  const [stores, requests] = await Promise.all([
    pool.query(
      `SELECT count(*) AS stores, count(lat) AS geocoded,
              count(*) FILTER (WHERE geocoded_at IS NULL) AS pending FROM stores`,
    ),
    pool.query(
      `SELECT kind, status FROM ingest_requests
       WHERE status IN ('pending', 'running') ORDER BY id`,
    ),
  ]);
  return {
    stores: Number(stores.rows[0].stores),
    geocoded: Number(stores.rows[0].geocoded),
    geocodePending: Number(stores.rows[0].pending),
    activeRequests: requests.rows,
  };
}

/** בקשה ל-worker של ה-ingest. בקשה זהה שכבר ממתינה לא נוצרת שוב. */
export async function enqueue(kind: "address" | "stores" | "prices", addressId: number | null = null) {
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
    `SELECT cl.chain_key, c.name AS chain_name, cl.club_id, cl.name, cl.member
     FROM clubs cl JOIN chains c ON c.key = cl.chain_key
     ORDER BY c.sort_order, cl.club_id`,
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

/** סף החיסכון (בש"ח) שמעליו מוצג פיצול לשני סניפים. */
export async function splitMinSaving(): Promise<number> {
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'split_min_saving'`);
  const value = rows.length > 0 ? Number(rows[0].value) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SPLIT_MIN_SAVING;
}

export async function setSplitMinSaving(value: number): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('split_min_saving', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(value)],
  );
}

export async function setChainHidden(chainKey: string, hidden: boolean): Promise<void> {
  await pool.query(`UPDATE chains SET hidden = $2 WHERE key = $1`, [chainKey, hidden]);
}
