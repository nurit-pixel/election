import { Quip } from "@/components/Quip";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminData, isAdmin, type LogRow, type QueueRow } from "@/lib/admin";
import { formatUpdated } from "@/lib/format";

export const dynamic = "force-dynamic";

const CARD = "rounded-pm-lg border border-line bg-card shadow-card";
const KIND: Record<string, string> = { stores: "סניפים", prices: "מחירים", promos: "מבצעים" };
const REQUEST: Record<string, string> = {
  address: "טעינה ליד כתובת",
  stores: "רענון סניפים",
  prices: "טעינת מחירים",
  track: "עדכון היסטוריה",
  nightly: "ריצה לילית",
};
const EVENT: Record<string, string> = {
  login: "כניסה",
  login_failed: "כניסה נכשלה",
  server_error: "שגיאת שרת",
  receipt_failed: "קריאת חשבונית נכשלה",
};

function Tile({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className={`${CARD} p-3`}>
      <div className={`text-2xl font-extrabold tabular-nums ${tone === "bad" && value > 0 ? "text-missing" : ""}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function LogList({ rows, empty }: { rows: LogRow[]; empty: string }) {
  if (rows.length === 0) return <p className={`${CARD} p-4 text-sm text-muted`}>{empty}</p>;
  return (
    <ul className={`${CARD} divide-y divide-subtle`}>
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`font-bold ${row.level === "error" ? "text-missing" : ""}`}>{EVENT[row.kind] ?? row.kind}</span>
            <time dateTime={new Date(row.at).toISOString()} className="shrink-0 text-xs text-muted">
              {formatUpdated(row.at)}
            </time>
          </div>
          <div className="break-words text-muted" dir="auto">
            {row.message}
          </div>
          {row.details && (
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer select-none text-link">פרטים</summary>
              <pre dir="ltr" className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-left">
                {row.details}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function QueueList({ rows }: { rows: QueueRow[] }) {
  return (
    <ul className={`${CARD} divide-y divide-subtle`}>
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold">
              {REQUEST[row.kind] ?? row.kind}{" "}
              <span className={`text-xs font-bold ${row.status === "failed" ? "text-missing" : row.status === "running" ? "text-aging" : "text-muted"}`}>
                {row.status === "running" ? "רצה עכשיו" : row.status === "failed" ? "נכשלה" : "ממתינה"}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted">{formatUpdated(row.startedAt ?? row.requestedAt)}</span>
          </div>
          {row.message && (
            <div className="break-words text-muted" dir="auto">
              {row.message.length > 220 ? `${row.message.slice(0, 220)}…` : row.message}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const data = await adminData();
  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings" className="text-sm text-link">
          חזרה להגדרות
        </Link>
        <h1 className="mt-1">ניהול</h1>
        <p className="mt-1 text-sm text-muted">מי מתחבר, ומה נכשל. המסך גלוי רק לך.</p>
        <Quip place="admin" className="mt-2" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="משתמשים" value={data.totals.users} />
        <Tile label="פעילים בשבוע" value={data.totals.active7d} />
        <Tile label="חדשים היום" value={data.totals.newToday} />
        <Tile label="כניסות היום" value={data.totals.loginsToday} />
        <Tile label="שגיאות ב-24 שעות" value={data.totals.errors24h} tone="bad" />
        <Tile label="כשלי טעינה ב-24 שעות" value={data.totals.ingestFailures24h} tone="bad" />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">משתמשים ({data.totals.users})</h2>
        <ul className={`${CARD} divide-y divide-subtle`}>
          {data.users.map((user) => (
            <li key={user.id} className="px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-bold">{user.name || "ללא שם"}</span>
                <span className="shrink-0 text-xs text-muted">כניסה אחרונה: {formatUpdated(user.lastLogin)}</span>
              </div>
              <div className="truncate text-muted" dir="ltr">
                {user.email || "—"}
              </div>
              <div className="mt-1 text-xs text-muted">
                הצטרף/ה {formatUpdated(user.createdAt)} · {user.lists} רשימות · {user.items} פריטים · {user.addresses} כתובות ·{" "}
                {user.tracked} במעקב
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">כניסות אחרונות</h2>
        <LogList rows={data.logins} empty="עוד לא נרשמו כניסות. הרישום מתחיל מהגרסה הזו." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">שגיאות באפליקציה</h2>
        <LogList rows={data.errors} empty="אין שגיאות רשומות." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">תור הטעינה</h2>
        {data.queue.length === 0 && data.failedRequests.length === 0 ? (
          <p className={`${CARD} p-4 text-sm text-muted`}>התור ריק.</p>
        ) : (
          <QueueList rows={[...data.queue, ...data.failedRequests]} />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">רשתות שהטעינה האחרונה שלהן נכשלה</h2>
        {data.ingestFailures.length === 0 ? (
          <p className={`${CARD} p-4 text-sm text-muted`}>כל הרשתות נטענו בהצלחה ב-48 השעות האחרונות.</p>
        ) : (
          <ul className={`${CARD} divide-y divide-subtle`}>
            {data.ingestFailures.map((failure) => (
              <li key={`${failure.chainName}-${failure.kind}`} className="px-4 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">
                    {failure.chainName} · {KIND[failure.kind] ?? failure.kind}{" "}
                    <span className={`text-xs ${failure.status === "failed" ? "text-missing" : "text-aging"}`}>
                      {failure.status === "failed" ? "נכשל" : "חלקי"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatUpdated(failure.startedAt)}</span>
                </div>
                {failure.error && (
                  <div className="break-words text-xs text-muted" dir="auto">
                    {failure.error.split("\n")[0].slice(0, 220)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
