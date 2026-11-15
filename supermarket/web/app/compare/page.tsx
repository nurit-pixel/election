import { Quip } from "@/components/Quip";
import { isOnlineStore } from "@/lib/online";
import Link from "next/link";
import { compareStores, type RankedStore } from "@/lib/compare";
import { formatDistance } from "@/lib/format";
import { freshness, winnerIndex, worstFreshness, type Freshness } from "@/lib/freshness";
import { FreshnessLine, Price } from "@/components/ui";
import { Stars } from "@/components/Stars";
import { PriceChart } from "@/components/PriceChart";
import { Meter } from "@/components/Meter";
import { StoresMap } from "@/components/StoresMap";
import { METER_COLORS, meterLevel } from "@/lib/meter";
import { nearComplete } from "@/lib/basket";
import { quip } from "@/lib/quips";
import { locatedAddresses } from "@/lib/settings";
import { basketChange, basketHistory } from "@/lib/basket-history";

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

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string; address?: string; view?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";
  const mapView = params.view === "map";
  const addresses = await locatedAddresses();
  // יותר מכתובת אחת: שואלים ליד איזו כתובת להשוות
  const chosen = addresses.find((a) => String(a.id) === params.address) ?? null;
  const allAddresses = params.address === "all";
  if (addresses.length >= 2 && !chosen && !allAddresses) return <AddressChooser addresses={addresses} />;
  const addressParam = chosen ? String(chosen.id) : allAddresses ? "all" : null;
  const withAddress = (extra = "") => `/compare?${[addressParam && `address=${addressParam}`, extra].filter(Boolean).join("&")}`;
  const { list, ranked, storesInRadius, bestSplit } = await compareStores(chosen?.id ?? null);
  const { points: history, itemsCounted, itemsTotal } =
    list.items.length > 0 ? await basketHistory(list.id) : { points: [], itemsCounted: 0, itemsTotal: 0 };
  const change = basketChange(history);
  const now = new Date();
  const rows = ranked.map((s) => withFreshness(s, now));
  const winner = winnerIndex(
    rows.map((r) => ({ complete: r.basket.complete, freshness: r.freshness, total: r.basket.total })),
  );
  const visible = showAll ? rows : rows.slice(0, FIRST_PAGE);
  const hidden = rows.length - visible.length;
  // המחיר להשוואה בין סניפים: הסל המשוער (חלקי מושלם במחיר הזול באזור של הפריטים החסרים)
  const priceOf = (r: Row) => r.estimate ?? r.basket.total;
  // סניפים שחסרים בהם יותר מפריט אחד לעומת המובילים מוצגים אחרי כותרת משלהם, במחיר שלהם בפועל ובלי מד:
  // המחיר המשוער שלהם רובו השלמה מסניפים אחרים, ולא אומר כמה יעלה לקנות בהם
  const maxFound = Math.max(0, ...rows.map((r) => r.basket.foundCount));
  const isTrailing = (r: Row) => !nearComplete(r.basket.foundCount, maxFound);
  const firstTrailing = rows.findIndex(isTrailing);
  const leaders = rows.filter((r) => !isTrailing(r));
  const cheapest = leaders.length > 0 ? priceOf(leaders[0]) : 0;
  const mostExpensive = leaders.length > 0 ? Math.max(...leaders.map(priceOf)) : 0;
  const levelOf = (r: Row) => (isTrailing(r) ? null : meterLevel(priceOf(r), cheapest, mostExpensive));

  if (list.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-pm-lg border border-dashed border-line bg-card px-5 py-10 text-center">
        <p className="font-bold">הרשימה ריקה</p>
        <p className="text-sm text-muted">מוסיפים מוצרים, ואז רואים איפה הסל הכי משתלם.</p>
        <Quip place="compareEmpty" className="w-full" />
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
        <Quip place="compare" className="mt-3" />
      </div>

      {addresses.length >= 2 && (
        <nav aria-label="ליד איזו כתובת" className="flex flex-wrap gap-2 text-sm">
          {[...addresses.map((a) => ({ key: String(a.id), label: a.label, active: chosen?.id === a.id })), { key: "all", label: "כל הכתובות", active: allAddresses }].map(
            (option) => (
              <Link
                key={option.key}
                href={`/compare?address=${option.key}`}
                aria-current={option.active ? "true" : undefined}
                className={`flex min-h-11 items-center rounded-full border px-4 font-bold ${
                  option.active ? "border-[var(--pm-button-edge)] bg-pm-turquoise text-pm-purple" : "border-line bg-card"
                }`}
              >
                {option.label}
              </Link>
            ),
          )}
        </nav>
      )}

      <nav aria-label="תצוגה" className="grid grid-cols-2 gap-1 rounded-[14px] bg-subtle p-1 text-sm font-bold">
        {[
          { key: "list", label: "רשימה", href: withAddress(), active: !mapView },
          { key: "map", label: "מפה", href: withAddress("view=map"), active: mapView },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-[11px] ${tab.active ? "bg-card shadow-card" : "text-muted"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {mapView && (
        <>
          <StoresMap
            stores={rows
              .filter((r) => r.lat != null && r.lng != null)
              .map((r) => ({
                storePk: r.storePk,
                lat: r.lat!,
                lng: r.lng!,
                name: `${r.chainName} · ${r.name}`,
                price: isTrailing(r) ? r.basket.total : priceOf(r),
                complete: r.basket.complete,
                rank: rows.indexOf(r) + 1,
                level: levelOf(r),
                approximate: r.approximate,
              }))}
            addresses={(chosen ? [chosen] : addresses).map((a) => ({ label: a.label, lat: a.lat, lng: a.lng, radiusKm: a.radiusKm }))}
          />
          <p className="text-xs text-muted">
            המספר על כל סניף הוא המקום שלו בהשוואה, והצבע לפי המד: טורקיז הכי זול, ורוד הכי יקר. סניף עם מסגרת מקווקוות
            מוקם רק לפי העיר. לחיצה על סניף מראה את המחיר ואת הפירוט.
          </p>
        </>
      )}

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

      {!mapView && (
      <ol className="space-y-3">
        {visible.map((row, i) => (
          <li key={row.storePk}>
            {rows.indexOf(row) === firstTrailing && (
              <h2 className="pb-2 pt-1 text-sm font-bold text-muted">סניפים שחסרים בהם כמה פריטים</h2>
            )}
            <StoreCard
              row={row}
              rank={rows.indexOf(row) + 1}
              now={now}
              winner={rows.indexOf(row) === winner}
              diff={priceOf(row) - cheapest}
              level={levelOf(row)}
              remark={rows.indexOf(row) < 3 ? quip(`rank${rows.indexOf(row) + 1}` as "rank1" | "rank2" | "rank3") : null}
            />
          </li>
        ))}
      </ol>
      )}

      {!mapView && hidden > 0 && (
        <Link
          href={withAddress("all=1")}
          className="flex min-h-[46px] items-center justify-center rounded-[13px] bg-subtle px-5 text-sm font-bold"
        >
          הצגת עוד {hidden} סניפים
        </Link>
      )}
      {!mapView && showAll && rows.length > FIRST_PAGE && (
        <Link href={withAddress()} className="block px-5 py-2 text-center text-sm font-bold text-link">
          הצגת 5 הזולים בלבד
        </Link>
      )}

      {history.length > 0 && (
        <section aria-labelledby="history-title" className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
          <h2 id="history-title" className="text-lg font-bold">
            הסל שלך לאורך זמן
          </h2>
          <p className="mt-1 text-sm text-muted">
            כל פריט במחיר הזול ביותר באזור, לפי מחיר המדף.
            {itemsCounted < itemsTotal && ` לפי ${itemsCounted} מתוך ${itemsTotal} פריטים; לשאר עוד אין היסטוריה.`}
            {change && (
              <>
                {" "}
                מאז {Number(change.since.slice(8, 10))}.{Number(change.since.slice(5, 7))}:{" "}
                <b className={change.amount > 0 ? "text-missing" : change.amount < 0 ? "text-fresh" : ""}>
                  {change.amount > 0 ? "התייקר ב-" : change.amount < 0 ? "הוזל ב-" : "בלי שינוי"}
                  {change.amount !== 0 && (
                    <>
                      <Price value={Math.abs(change.amount)} /> ({Math.abs(change.pct)}%)
                    </>
                  )}
                </b>
              </>
            )}
          </p>
          {history.length > 1 ? (
            <PriceChart points={history} target={null} unit="" />
          ) : (
            <p className="mt-2 text-sm text-muted">עוד אין מספיק ימים לגרף. ההיסטוריה נאספת מדי יום.</p>
          )}
        </section>
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
  level,
  remark,
}: {
  row: Row;
  rank: number;
  now: Date;
  winner: boolean;
  /** כמה יותר מהסל הזול ביותר (לפי הסל המשוער) */
  diff: number;
  /** המקום על מד המחיר, 0 (הכי זול) עד 4; null לסניף שחסרים בו כמה פריטים (בלי מד) */
  level: number | null;
  /** הערה צינית לשלושת המקומות הראשונים */
  remark: string | null;
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
      {level != null && <Meter level={level} className="mb-3" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-normal">
            {(
              <span
                className={`me-1.5 inline-grid size-[26px] place-items-center rounded-[9px] text-xs font-extrabold ${
                  winner ? "bg-fresh text-card" : "bg-subtle"
                }`}
                style={winner || level == null ? undefined : { background: METER_COLORS[level], color: "#2b0735" }}
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
          {s.rating != null && <Stars value={s.rating} count={s.reviewCount} className="mt-0.5" />}
        </div>
        <div className="max-w-[46%] shrink-0 text-left">
          {/* המחיר הראשי: לסל חלקי, הסל המשוער עם הפריטים החסרים, כדי שהסדר מהזול ליקר יהיה ברור */}
          {level != null && !b.complete && s.estimate != null && <span className="text-[11px] font-bold text-muted">בערך</span>}
          <Price
            value={level != null && !b.complete && s.estimate != null ? s.estimate : b.total}
            className={`block font-extrabold leading-tight tracking-tight ${level == null ? "text-[20px] text-muted" : "text-[25px] text-ink"}`}
          />
          <div className="text-[11px] leading-normal text-muted">
            {level == null ? (
              <span className="font-bold">
                רק {b.foundCount} מתוך {b.itemCount} פריטים
              </span>
            ) : winner ? (
              <span className="font-bold text-fresh">הכי משתלם</span>
            ) : diff > 0.004 ? (
              <>
                + <Price value={diff} /> מהזול ביותר
              </>
            ) : b.complete ? (
              "סל מלא"
            ) : (
              "עם השלמת החסרים"
            )}
          </div>
        </div>
      </div>

      {remark && (
        <p className="mt-2 text-sm font-bold leading-snug">
          <span aria-hidden className="me-1 text-pm-pink">״</span>
          {remark}
        </p>
      )}
      {level != null && !b.complete && s.estimate != null && (
        <p className="mt-1 text-xs text-muted">
          בסניף עצמו: <Price value={b.total} className="font-bold text-ink" /> על {b.foundCount} הפריטים שיש בו. את השאר
          חישבנו לפי המחיר הזול שלהם באזור.
        </p>
      )}
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
        {b.substituteCount > 0 && (
          <span className={`${BADGE} bg-info-surface text-info`}>
            {b.substituteCount === 1 ? "פריט אחד במותג אחר" : `${b.substituteCount} פריטים במותג אחר`}
          </span>
        )}
        {isOnlineStore(s.storeType) && (
          <span className={`${BADGE} bg-pm-orange text-pm-purple`}>{s.storeType === "3" ? "גם אונליין" : "אונליין · משלוח"}</span>
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
        {isOnlineStore(s.storeType) ? "פירוט הסל וקישור להזמנה ←" : "פירוט הסל בסניף ←"}
      </span>
    </Link>
  );
}

/** כשיש יותר מכתובת אחת: ליד איזו כתובת להשוות */
function AddressChooser({ addresses }: { addresses: { id: number; label: string }[] }) {
  return (
    <div className="space-y-4">
      <h1>ליד איזו כתובת להשוות?</h1>
      <p className="text-sm text-muted">יש לך כמה כתובות שמורות. בוחרים כתובת, ונשווה רק בין הסניפים שברדיוס שלה.</p>
      <ul className="space-y-2">
        {addresses.map((address) => (
          <li key={address.id}>
            <Link
              href={`/compare?address=${address.id}`}
              className="flex min-h-14 items-center justify-between rounded-pm-lg border-2 border-[var(--pm-button-edge)] bg-card px-4 text-lg font-bold shadow-[3px_3px_0_var(--pm-turquoise)]"
            >
              {address.label}
              <span aria-hidden className="text-pm-pink">←</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/compare?address=all"
            className="flex min-h-14 items-center justify-between rounded-pm-lg border border-line bg-card px-4 font-bold"
          >
            כל הכתובות יחד
            <span aria-hidden className="text-muted">←</span>
          </Link>
        </li>
      </ul>
      <Quip place="radius" />
    </div>
  );
}
