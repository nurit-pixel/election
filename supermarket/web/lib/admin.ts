import "server-only";
import { pool } from "./db";
import { currentUserId } from "./session";

/** מנהל: מי שכתובת המייל שלו מופיעה ב-ADMIN_EMAILS. בלי הגדרה, המשתמש הראשון שנרשם. */
export async function isAdmin(): Promise<boolean> {
  const id = await currentUserId();
  if (id == null) return false;
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const { rows } = await pool.query(
    emails.length > 0
      ? `SELECT lower(email) = ANY($2::text[]) AS admin FROM users WHERE id = $1`
      : `SELECT id = (SELECT min(id) FROM users) AS admin FROM users WHERE id = $1`,
    emails.length > 0 ? [id, emails] : [id],
  );
  return rows[0]?.admin === true;
}

export type AdminUser = {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  lastLogin: string;
  lists: number;
  items: number;
  addresses: number;
  tracked: number;
};

export type LogRow = {
  id: number;
  at: string;
  level: "info" | "error";
  kind: string;
  email: string | null;
  message: string;
  details: string | null;
};

export type IngestFailure = { chainName: string; kind: string; status: string; startedAt: string; error: string | null };
export type QueueRow = { id: number; kind: string; status: string; requestedAt: string; startedAt: string | null; message: string | null };

export type AdminData = {
  totals: { users: number; active7d: number; newToday: number; loginsToday: number; errors24h: number; ingestFailures24h: number };
  users: AdminUser[];
  logins: LogRow[];
  errors: LogRow[];
  ingestFailures: IngestFailure[];
  queue: QueueRow[];
  failedRequests: QueueRow[];
};

const logRow = (r: Record<string, unknown>): LogRow => ({
  id: Number(r.id),
  at: r.at as string,
  level: r.level as LogRow["level"],
  kind: r.kind as string,
  email: (r.email as string) ?? null,
  message: r.message as string,
  details: (r.details as string) ?? null,
});

const queueRow = (r: Record<string, unknown>): QueueRow => ({
  id: r.id as number,
  kind: r.kind as string,
  status: r.status as string,
  requestedAt: r.requested_at as string,
  startedAt: (r.started_at as string) ?? null,
  message: (r.message as string) ?? null,
});

export async function adminData(): Promise<AdminData> {
  const LOG = `SELECT l.id, l.at, l.level, l.kind, u.email, l.message, l.details
               FROM app_log l LEFT JOIN users u ON u.id = l.user_id`;
  const [totals, users, logins, errors, failures, queue, failed] = await Promise.all([
    pool.query(
      `SELECT (SELECT count(*) FROM users) AS users,
              (SELECT count(*) FROM users WHERE last_login > now() - interval '7 days') AS active7d,
              (SELECT count(*) FROM users WHERE created_at > date_trunc('day', now())) AS new_today,
              (SELECT count(*) FROM app_log WHERE kind = 'login' AND at > date_trunc('day', now())) AS logins_today,
              (SELECT count(*) FROM app_log WHERE level = 'error' AND at > now() - interval '24 hours') AS errors24h,
              (SELECT count(*) FROM ingest_runs WHERE status = 'failed'
                 AND started_at > now() - interval '24 hours') AS ingest_failures24h`,
    ),
    pool.query(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_login,
              (SELECT count(*) FROM lists l WHERE l.user_id = u.id) AS lists,
              (SELECT count(*) FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.user_id = u.id) AS items,
              (SELECT count(*) FROM addresses a WHERE a.user_id = u.id) AS addresses,
              (SELECT count(*) FROM tracked_products t WHERE t.user_id = u.id) AS tracked
       FROM users u ORDER BY u.last_login DESC LIMIT 200`,
    ),
    pool.query(`${LOG} WHERE l.kind IN ('login', 'login_failed') ORDER BY l.at DESC LIMIT 40`),
    pool.query(`${LOG} WHERE l.level = 'error' AND l.kind <> 'login_failed' ORDER BY l.at DESC LIMIT 40`),
    // הכשל האחרון של כל רשת וסוג ב-48 השעות האחרונות, רק אם לא הייתה אחריו ריצה תקינה
    pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (r.chain_key, r.kind) c.name AS chain_name, r.kind, r.status, r.started_at, r.error
         FROM ingest_runs r JOIN chains c ON c.key = r.chain_key
         WHERE r.started_at > now() - interval '48 hours' AND r.status <> 'running'
         ORDER BY r.chain_key, r.kind, r.started_at DESC) latest
       WHERE status IN ('failed', 'partial') ORDER BY started_at DESC`,
    ),
    pool.query(
      `SELECT id, kind, status, requested_at, started_at, message FROM ingest_requests
       WHERE status IN ('pending', 'running') ORDER BY (status = 'running') DESC, id LIMIT 20`,
    ),
    pool.query(
      `SELECT id, kind, status, requested_at, started_at, message FROM ingest_requests
       WHERE status = 'failed' AND requested_at > now() - interval '48 hours' ORDER BY id DESC LIMIT 10`,
    ),
  ]);
  const t = totals.rows[0];
  return {
    totals: {
      users: Number(t.users),
      active7d: Number(t.active7d),
      newToday: Number(t.new_today),
      loginsToday: Number(t.logins_today),
      errors24h: Number(t.errors24h),
      ingestFailures24h: Number(t.ingest_failures24h),
    },
    users: users.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      createdAt: r.created_at,
      lastLogin: r.last_login,
      lists: Number(r.lists),
      items: Number(r.items),
      addresses: Number(r.addresses),
      tracked: Number(r.tracked),
    })),
    logins: logins.rows.map(logRow),
    errors: errors.rows.map(logRow),
    ingestFailures: failures.rows.map((r) => ({
      chainName: r.chain_name,
      kind: r.kind,
      status: r.status,
      startedAt: r.started_at,
      error: r.error,
    })),
    queue: queue.rows.map(queueRow),
    failedRequests: failed.rows.map(queueRow),
  };
}
