import Link from "next/link";
import { compareStores, type RankedStore } from "@/lib/compare";
import { formatDistance } from "@/lib/format";
import { freshness, winnerIndex, worstFreshness, type Freshness } from "@/lib/freshness";
import { FreshnessLine, Mascot, Price } from "@/components/ui";

export const dynamic = "force-dynamic";

const FRESH_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);
const FIRST_PAGE = 5;

type Row = RankedStore & { freshness: Freshness; observedAt: string | null };

/** רעננות הסל בסניף: לפי המחיר הישן ביותר מבין הפריטים שנמצאו */
function withFreshness(store: RankedStore, now: Date): Row {
  const times = store.basket.lines.flatMap((l) => (l.found ? [l.fileTime] : []));
  const oldest = times.length > 0 ? times.reduce((a, b) => (a < b ? a : b)) : null;
  return {
    ...store,
    freshness: worstFreshness(times.map((t) => freshness(t, now, FRESH_HOURS))),
    observedAt: oldest,
  };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const showAll = (await searchParams).all === "1";
  const { list, ranked, storesInRadius, bestSplit } = await compareStores();
  const now = new Date();
  const rows = ranked.map((s) => withFreshness(s, now));
  const winner = winnerIndex(
    rows.map((r) => ({ complete: r.basket.complete, freshness: r.freshness, total: r.basket.total })),
  );
  const visible = showAll ? rows : rows.slice(0, FIRST_PAGE);
  const hidden = rows.length - visible.length;
  const cheapestComplete = rows.find((r) => r.basket.complete)?.basket.total ?? null;
  const firstPartial = visible.findIndex((r) => !r.basket.complete);

  if (list.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-pm-lg bg-card p-6 text-center shadow-card">
        <Mascot />
        <p className="text-muted">הרשימה ריקה. מוסיפים מוצרים, ואז רואים איפה הסל הכי משתלם.</p>
        <Link href="/" className="rounded-pm bg-primary px-5 py-3 font-bold text-on-primary">
          לרשימה
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">השוואת סניפים</h1>
        <p className="text-sm text-muted">
          {list.name} · {list.items.length} פריטים · {storesInRadius} סניפים ברדיוס · כולל מבצעים
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-pm-lg border border-pm-pink/40 bg-missing-surface p-4">
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pm-pink text-sm font-black text-white">
          !
        </span>
        <div>
          <div className="font-bold">השוואה הוגנת, בלי להמציא</div>
          <div className="text-sm text-muted">סניף חסר לא מקבל תג זוכה, גם אם הסכום נמוך.</div>
        </div>
      </div>

      {storesInRadius === 0 && (
        <p className="rounded-pm-lg bg-card p-4 text-muted shadow-card">
          אין סניפים עם מחירים ברדיוס.{" "}
          <Link href="/settings" className="font-bold text-link underline">
            מוסיפים כתובת בהגדרות
          </Link>
          .
        </p>
      )}

      {bestSplit && (
        <Link href="/split" className="block rounded-pm-lg border border-info/40 bg-info-surface p-4 text-sm text-info shadow-card">
          <div className="font-bold">
            {bestSplit.saving != null ? (
              <>
                פיצול לשני סניפים חוסך <Price value={bestSplit.saving} />
              </>
            ) : (
              "בפיצול לשני סניפים נמצאים יותר פריטים"
            )}
          </div>
          <div className="mt-0.5">
            {bestSplit.a.chainName} · {bestSplit.a.name} + {bestSplit.b.chainName} · {bestSplit.b.name} –{" "}
            <Price value={bestSplit.total} /> ←
          </div>
        </Link>
      )}

      <ol className="space-y-3">
        {visible.map((row, i) => (
          <li key={row.storePk}>
            {i === firstPartial && (
              <h2 className="pb-2 pt-1 text-sm font-bold text-muted">
                {firstPartial > 0 ? "סניפים שחסרים בהם פריטים" : "באף סניף אין את כל הפריטים"}
              </h2>
            )}
            <StoreCard
              row={row}
              now={now}
              winner={rows.indexOf(row) === winner}
              diff={row.basket.complete && cheapestComplete != null ? row.basket.total - cheapestComplete : null}
            />
          </li>
        ))}
      </ol>

      {hidden > 0 && (
        <Link
          href="/compare?all=1"
          className="block rounded-pm border border-line bg-card px-5 py-3 text-center font-bold text-link"
        >
          הצגת עוד {hidden} סניפים
        </Link>
      )}
      {showAll && rows.length > FIRST_PAGE && (
        <Link href="/compare" className="block px-5 py-2 text-center text-sm font-bold text-link">
          הצגת 5 הזולים בלבד
        </Link>
      )}
    </div>
  );
}

function StoreCard({ row: s, now, winner, diff }: { row: Row; now: Date; winner: boolean; diff: number | null }) {
  const b = s.basket;
  const missing = b.itemCount - b.foundCount;
  return (
    <Link
      href={`/store/${s.storePk}`}
      className={`relative block overflow-hidden rounded-pm-xl bg-card shadow-card ${
        winner ? "border-2 border-fresh" : "border border-line"
      }`}
    >
      {winner && (
        <div className="absolute start-0 top-0 rounded-ee-pm bg-fresh px-4 py-1 text-sm font-bold text-card">
          הכי משתלם
        </div>
      )}
      <div className={`flex items-start justify-between gap-3 px-4 pb-3 ${winner ? "pt-10" : "pt-4"}`}>
        <div className="min-w-0 space-y-1">
          <div className="text-lg font-bold leading-snug">
            {s.chainName} · {s.name}
          </div>
          <div className="text-xs text-muted">
            {[s.address, s.city].filter(Boolean).join(", ")}
            {s.distanceKm != null && ` · ${formatDistance(s.distanceKm)}`}
            {s.approximate && " (מיקום משוער)"}
          </div>
          <FreshnessLine status={s.freshness} observedAt={s.observedAt} now={now} className="block" />
          {b.complete ? (
            <div className="text-sm font-medium text-fresh">כל {b.itemCount} הפריטים זמינים</div>
          ) : (
            <div className="text-sm font-medium text-missing">
              {missing === 1 ? "חסר מחיר לפריט אחד" : `חסרים מחירים ל-${missing} פריטים`}. הסכום המוצג חלקי.
            </div>
          )}
          {b.savings > 0 && (
            <div className="text-sm font-medium text-fresh">
              חיסכון במבצעים <Price value={b.savings} />
            </div>
          )}
          {b.clubSavings > 0 && (
            <div className="text-xs text-club">
              לחברי מועדון: עוד <Price value={b.clubSavings} />
            </div>
          )}
        </div>
        <div className="shrink-0 text-end">
          <Price value={b.total} className={`block text-3xl font-extrabold ${b.complete ? "text-ink" : "text-muted"}`} />
          <div className="text-xs text-muted">
            {b.complete ? `סל מלא · ${b.foundCount} מתוך ${b.itemCount}` : `לפי ${b.foundCount} מתוך ${b.itemCount} פריטים`}
          </div>
          {diff != null && diff > 0 && (
            <div className="text-xs font-medium text-missing">
              <Price value={diff} /> יותר מהזול
            </div>
          )}
        </div>
      </div>
      <div className="mx-4 flex items-center justify-between border-t border-line py-3 text-sm font-bold">
        <span>לצפייה בפירוט הסל</span>
        <span aria-hidden className="text-lg text-pm-pink">
          ←
        </span>
      </div>
    </Link>
  );
}
