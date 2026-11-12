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
};

export async function listAddresses(): Promise<Address[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.label, a.address, a.radius_km,
            CASE WHEN a.geocoded_at IS NULL THEN 'pending'
                 WHEN a.lat IS NULL THEN 'failed' ELSE 'ok' END AS state,
            count(s.id) AS in_radius,
            count(s.id) FILTER (WHERE s.prices_file_time IS NOT NULL) AS with_prices
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
  stores: number;
  geocoded: number;
  storesWithPrices: number;
  /** קובץ המחירים הישן ביותר מבין הסניפים שנטענו */
  oldestPrices: string | null;
  /** יש מחירים, אבל הם ישנים או שהטעינה האחרונה נכשלה */
  notUpdated: boolean;
  storesRun: RunInfo | null;
  pricesRun: RunInfo | null;
};

export async function chainStatuses(): Promise<ChainStatus[]> {
  const { rows } = await pool.query(
    `SELECT c.key, c.name, c.is_pharm,
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
               WHERE chain_key = c.key AND kind = 'prices' ORDER BY id DESC LIMIT 1) r) AS prices_run
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
      stores: Number(r.stores),
      geocoded: Number(r.geocoded),
      storesWithPrices: Number(r.with_prices),
      oldestPrices: r.oldest_prices,
      notUpdated:
        Number(r.with_prices) > 0 && (r.stale === true || pricesRun?.status === "failed"),
      storesRun: run(r.stores_run),
      pricesRun,
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
