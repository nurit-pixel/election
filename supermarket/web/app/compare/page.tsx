import Link from "next/link";
import { compareStores, type RankedStore } from "@/lib/compare";
import { formatDistance } from "@/lib/format";
import { freshness, winnerIndex, worstFreshness, type Freshness } from "@/lib/freshness";
import { FreshnessLine, Price } from "@/components/ui";

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
      <div className="flex flex-col items-center gap-3 rounded-pm-lg border border-dashed border-line bg-card px-5 py-10 text-center">
        <p className="font-bold">הרשימה ריקה</p>
        <p className="text-sm text-muted">מוסיפים מוצרים, ואז רואים איפה הסל הכי משתלם.</p>
        <Link href="/" className="rounded-pm bg-primary px-5 py-3 text-on-primary">
          לרשימה
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1>איפה הסל הכי משתלם?</h1>
        <p className="mt-1 text-sm text-muted">
          {list.name} · {list.items.length} פריטים · {storesInRadius} סניפים ברדיוס · כולל מבצעים
        </p>
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
        <div className="rounded-[18px] bg-info-surface p-4 text-sm text-info">
          <div className="font-bold">
            {bestSplit.saving != null ? (
              <>
                שני סניפים, חיסכון של <Price value={bestSplit.saving} />
              </>
            ) : (
              "בשני סניפים נמצאים יותר פריטים"
            )}
          </div>
          <p className="mt-1">
            {bestSplit.a.chainName} · {bestSplit.a.name} + {bestSplit.b.chainName} · {bestSplit.b.name} · סך הכול{" "}
            <Price value={bestSplit.total} />
          </p>
          <Link href="/split" className="mt-3 flex min-h-11 items-center justify-center rounded-[13px] bg-card font-bold">
            בדיקת הצעת הפיצול ←
          </Link>
        </div>
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
              rank={row.basket.complete ? i + 1 : null}
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
          className="flex min-h-[46px] items-center justify-center rounded-[13px] bg-subtle px-5 text-sm font-bold"
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

const BADGE = "inline-flex rounded-lg px-2.5 py-1 text-xs font-bold leading-snug";

function StoreCard({
  row: s,
  rank,
  now,
  winner,
  diff,
}: {
  row: Row;
  rank: number | null;
  now: Date;
  winner: boolean;
  diff: number | null;
}) {
  const b = s.basket;
  const missing = b.itemCount - b.foundCount;
  return (
    <Link
      href={`/store/${s.storePk}`}
      className={`block rounded-pm-lg bg-card p-[18px] ${
        winner ? "border-2 border-fresh shadow-[5px_0_0_var(--pm-turquoise)]" : "border border-line shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-normal">
            {rank != null && (
              <span
                className={`me-1.5 inline-grid size-[26px] place-items-center rounded-[9px] text-xs font-extrabold ${
                  winner ? "bg-fresh text-card" : "bg-subtle"
                }`}
              >
                <span className="sr-only">מקום </span>
                {rank}
              </span>
            )}
            {s.chainName} · {s.name}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {[s.address, s.city].filter(Boolean).join(", ")}
            {s.distanceKm != null && ` · ${formatDistance(s.distanceKm)}`}
            {s.approximate && " (מיקום משוער)"}
          </p>
        </div>
        <div className="max-w-[46%] shrink-0 text-left">
          <Price
            value={b.total}
            className={`block text-[25px] font-extrabold leading-tight tracking-tight ${b.complete ? "text-ink" : "text-muted"}`}
          />
          <div className="text-[11px] leading-normal text-muted">
            {winner ? (
              <span className="font-bold text-fresh">הכי משתלם</span>
            ) : diff != null && diff > 0 ? (
              <>
                + <Price value={diff} /> מהזול ביותר
              </>
            ) : b.complete ? (
              "סל מלא"
            ) : (
              "סכום חלקי"
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {b.complete ? (
          <span className={`${BADGE} bg-fresh-surface text-fresh`}>
            סל מלא · {b.foundCount} מתוך {b.itemCount}
          </span>
        ) : (
          <span className={`${BADGE} bg-aging-surface text-aging`}>
            {missing === 1 ? "חסר מחיר לפריט אחד" : `חסרים מחירים ל-${missing} פריטים`} · {b.foundCount} מתוך {b.itemCount}
          </span>
        )}
        {b.savings > 0 && (
          <span className={`${BADGE} bg-fresh-surface text-fresh`}>
            חיסכון במבצעים&nbsp;
            <Price value={b.savings} />
          </span>
        )}
        {b.clubSavings > 0 && (
          <span className={`${BADGE} bg-club-surface text-club`}>
            לחברי מועדון: חיסכון אפשרי&nbsp;
            <Price value={b.clubSavings} />
          </span>
        )}
      </div>
      <FreshnessLine status={s.freshness} observedAt={s.observedAt} now={now} className="mt-2 block" />

      <span className="mt-3 flex min-h-[46px] items-center justify-center rounded-[13px] bg-subtle text-sm font-bold">
        פירוט הסל בסניף ←
      </span>
    </Link>
  );
}
