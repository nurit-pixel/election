"use client";

import { useState } from "react";
import { describeChange, withChanges, type HistoryEntry } from "@/lib/historyDiff";
import BetDetails from "./BetDetails";

const TZ = "Asia/Jerusalem";
const fmt = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
};
const changesLabel = (n: number) => (n === 1 ? "שינוי אחד" : `${n} שינויים`);

// ציר זמן של הגשות: מהחדשה לישנה, עם מה שהשתנה בכל פעם. לחיצה פותחת את ההימור המלא באותו רגע.
export default function BetHistory({ entries, available = true }: { entries: HistoryEntry[]; available?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!available) return <p className="text-sm text-muted">ההיסטוריה עוד לא הופעלה במערכת.</p>;
  if (!entries.length) return <p className="text-sm text-muted">אין עדיין הגשות.</p>;

  const rows = withChanges(entries);
  return (
    <ol className="relative space-y-3 ps-1">
      <span className="absolute inset-y-3 start-[13px] w-px bg-gradient-to-b from-cyan via-accent/60 to-transparent" aria-hidden />
      {rows.map((e, i) => {
        const isOpen = open === e.id;
        const first = e.changes === null;
        const same = e.changes !== null && e.changes.length === 0;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={`z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-bg text-xs font-display ${
                i === 0 ? "border-cyan text-cyan shadow-[0_0_10px_rgb(34_211_238/0.5)]" : "border-line text-muted"
              }`}
            >
              {rows.length - i}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="flex w-full min-h-10 flex-wrap items-baseline gap-x-2 text-start"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : e.id)}
              >
                <span className="font-semibold">{fmt(e.created_at)}</span>
                {i === 0 && <span className="chip px-2 py-0 text-xs text-cyan">נוכחי</span>}
                <span className="text-sm text-muted">{first ? "הגשה ראשונה" : same ? "נשלח שוב בלי שינוי" : changesLabel(e.changes!.length)}</span>
                <span className="ms-auto text-xs text-cyan">{isOpen ? "סגירה" : "הצגה"}</span>
              </button>
              {!first && !same && (
                <ul className="mt-1 space-y-0.5 text-sm text-fg/85">
                  {e.changes!.slice(0, isOpen ? undefined : 4).map((c, j) => (
                    <li key={j}>• {describeChange(c)}</li>
                  ))}
                  {!isOpen && e.changes!.length > 4 && <li className="text-muted">ועוד {e.changes!.length - 4}…</li>}
                </ul>
              )}
              {isOpen && (
                <div className="mt-2 rounded-xl border border-line bg-bg/60 p-3">
                  <BetDetails bet={e} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
