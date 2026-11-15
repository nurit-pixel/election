import "server-only";
import { pool } from "./db";
import { searchProducts } from "./search";
import { getList } from "./lists";
import { suggestionsFor } from "./alternatives";
import { compareStores } from "./compare";
import { basketHistory } from "./basket-history";
import { listAddresses } from "./settings";
import { unreadAlertCount } from "./tracking";

export type Timing = { name: string; ms: number; error?: string };

async function measure(name: string, run: () => Promise<unknown>): Promise<Timing> {
  const start = performance.now();
  try {
    await run();
    return { name, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { name, ms: Math.round(performance.now() - start), error: String(error).slice(0, 200) };
  }
}

export type PerfReport = {
  timings: Timing[];
  cacheHitPct: number | null;
  tables: { name: string; rows: number; size: string }[];
  busy: { state: string; seconds: number; query: string }[];
};

/** מדידת הזמן של כל חלק באפליקציה, על הנתונים של המשתמש המחובר, ומצב מסד הנתונים */
export async function perfReport(): Promise<PerfReport> {
  const timings: Timing[] = [];
  timings.push(await measure("שאילתה ריקה (חיבור למסד)", () => pool.query("SELECT 1")));
  timings.push(await measure("מונה התראות (בכל דף)", () => unreadAlertCount()));
  let list: Awaited<ReturnType<typeof getList>> | null = null;
  timings.push(await measure("טעינת הרשימה", async () => (list = await getList())));
  if (list) {
    const items = (list as Awaited<ReturnType<typeof getList>>).items;
    timings.push(await measure("חלופה זולה (מסך הרשימה)", () => suggestionsFor(items)));
    timings.push(await measure("גרף הסל (מסך ההשוואה)", () => basketHistory((list as { id: number }).id)));
  }
  timings.push(await measure("השוואת סניפים", () => compareStores(null)));
  timings.push(await measure("חיפוש \"חלב\"", () => searchProducts("חלב")));
  timings.push(await measure("חיפוש \"במבה\"", () => searchProducts("במבה")));
  timings.push(await measure("כתובות (מסך ההגדרות)", () => listAddresses()));

  const [cache, tables, busy] = await Promise.all([
    pool.query(
      `SELECT round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 1) AS pct
       FROM pg_stat_database WHERE datname = current_database()`,
    ),
    pool.query(
      `SELECT relname AS name, greatest(n_live_tup, (SELECT reltuples FROM pg_class WHERE oid = relid))::bigint AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size
       FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 6`,
    ),
    pool.query(
      `SELECT state, extract(epoch FROM now() - query_start)::int AS seconds, left(query, 120) AS query
       FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle'
       ORDER BY query_start LIMIT 5`,
    ),
  ]);
  return {
    timings,
    cacheHitPct: cache.rows[0]?.pct == null ? null : Number(cache.rows[0].pct),
    tables: tables.rows.map((r) => ({ name: r.name, rows: Number(r.rows), size: r.size })),
    busy: busy.rows.map((r) => ({ state: r.state, seconds: Number(r.seconds), query: r.query })),
  };
}
