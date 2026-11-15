import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { perfReport } from "@/lib/perf";

export const dynamic = "force-dynamic";

const CARD = "rounded-pm-lg border border-line bg-card shadow-card";

/** מסך אבחון: כמה זמן לוקח כל חלק באפליקציה על הנתונים האמיתיים בשרת. מנהל בלבד. */
export default async function PerfPage() {
  if (!(await isAdmin())) notFound();
  const started = performance.now();
  const report = await perfReport();
  const total = Math.round(performance.now() - started);
  const tone = (ms: number) => (ms >= 1000 ? "text-missing" : ms >= 300 ? "text-aging" : "text-fresh");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin" className="text-sm text-link">
          חזרה לניהול
        </Link>
        <h1 className="mt-1">מהירות</h1>
        <p className="mt-1 text-sm text-muted">כמה זמן לוקח כל חלק, על הנתונים שלך בשרת. סך הכול: {total} ms.</p>
      </div>
      <ul className={`${CARD} divide-y divide-subtle`}>
        {report.timings.map((t) => (
          <li key={t.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
            <span>{t.name}</span>
            <span className={`shrink-0 font-bold tabular-nums ${tone(t.ms)}`} dir="ltr">
              {t.ms} ms
            </span>
            {t.error && <span className="block w-full text-xs text-missing">{t.error}</span>}
          </li>
        ))}
      </ul>
      <div className={`${CARD} space-y-1 p-4 text-sm`}>
        <div>
          פגיעות במטמון של מסד הנתונים: <b dir="ltr">{report.cacheHitPct ?? "?"}%</b>{" "}
          <span className="text-muted">(מתחת ל-95% אומר שהוא קורא הרבה מהדיסק)</span>
        </div>
        {report.tables.map((t) => (
          <div key={t.name} className="text-muted">
            {t.name}: {t.rows.toLocaleString("he-IL")} שורות, {t.size}
          </div>
        ))}
      </div>
      <div className={`${CARD} space-y-2 p-4 text-sm`}>
        <div className="font-bold">שאילתות שרצות עכשיו ({report.busy.length})</div>
        {report.busy.length === 0 && <div className="text-muted">אין.</div>}
        {report.busy.map((b, i) => (
          <div key={i} className="text-xs">
            <b dir="ltr">{b.seconds}s</b> · {b.state}
            <pre dir="ltr" className="mt-0.5 whitespace-pre-wrap break-words rounded bg-subtle p-1.5 text-left">
              {b.query}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
