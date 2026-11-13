import Link from "next/link";
import {
  chainStatuses,
  MAX_ADDRESSES,
  listAddresses,
  listClubs,
  overview,
  splitMinSaving,
  type ChainStatus,
  type RunInfo,
} from "@/lib/settings";
import { cookies } from "next/headers";
import { formatUpdated } from "@/lib/format";
import { THEME_COOKIE } from "@/lib/theme";
import { uid } from "@/lib/session";
import { getUser } from "@/lib/users";
import { isAdmin } from "@/lib/admin";
import { geocodePendingAddresses } from "@/lib/geocode";
import {
  addAddress,
  deleteAddress,
  fixAddress,
  logout,
  requestPrices,
  requestStores,
  setClub,
  toggleChain,
  updateRadius,
  setTheme,
  updateSplitThreshold,
} from "./actions";

export const dynamic = "force-dynamic";

const DEFAULT_RADIUS = Number(process.env.DEFAULT_RADIUS_KM ?? 5);
const REQUEST_LABELS: Record<string, string> = {
  address: "טעינת סניפים ליד כתובת",
  stores: "רענון רשימות סניפים",
  prices: "טעינת מחירים",
  track: "עדכון היסטוריית מחירים",
  nightly: "הריצה הלילית",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notfound?: string; address?: string; label?: string }>;
}) {
  const retry = await searchParams;
  await geocodePendingAddresses();
  const [addresses, chains, info, clubs, threshold, user] = await Promise.all([
    listAddresses(),
    chainStatuses(),
    overview(),
    listClubs(),
    splitMinSaving(),
    uid().then(getUser),
  ]);
  const admin = await isAdmin();
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = saved === "light" || saved === "dark" ? saved : "system";

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">הגדרות</h1>
      <div className="flex items-center justify-between gap-3 rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <div className="min-w-0">
          <div className="truncate font-bold">{user?.name ?? "החשבון שלי"}</div>
          <div className="truncate text-sm text-muted" dir="ltr">
            {user?.email}
          </div>
        </div>
        <form action={logout}>
          <button className="min-h-11 shrink-0 rounded-[13px] bg-subtle px-4 text-sm font-bold">יציאה</button>
        </form>
      </div>
      {admin && (
        <Link
          href="/admin"
          className="flex min-h-12 items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 font-bold shadow-card"
        >
          ניהול: משתמשים ושגיאות
          <span aria-hidden className="text-pm-pink">
            ←
          </span>
        </Link>
      )}
      <Link
        href="/help"
        className="flex min-h-12 items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 font-bold shadow-card"
      >
        איך זה עובד
        <span aria-hidden className="text-pm-pink">
          ←
        </span>
      </Link>
      <details open id="addresses" className="group scroll-mt-4 space-y-3">
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 py-3 shadow-card">
          <h2 className="text-lg font-bold">כתובות ורדיוס</h2>
          <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">▾</span>
        </summary>
        <p className="text-sm text-muted">
          מחירים נטענים רק לסניפים שברדיוס מהכתובות השמורות. הוספת כתובת מפעילה טעינה מיידית.
        </p>

        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{a.label}</div>
                  {a.label !== a.address && (
                    <div className="truncate text-sm text-muted">{a.address}</div>
                  )}
                </div>
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-sm text-missing">מחיקה</button>
                </form>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {a.state === "pending" && <span className="text-muted">מאתר את הכתובת…</span>}
                {a.state === "failed" && retry.notfound !== String(a.id) && (
                  <span className="text-missing">הכתובת לא נמצאה. מתקנים אותה כאן למטה.</span>
                )}
                {a.state === "ok" && a.locatedName && (
                  <div className={a.approximate ? "text-aging" : "text-muted"}>
                    {a.approximate ? "מיקום משוער, מספר הבית או הרחוב לא זוהו: " : "זוהה: "}
                    {a.locatedName}
                  </div>
                )}
                {a.state === "ok" && (
                  <div className="text-muted">
                    {a.storesInRadius} סניפים ברדיוס · {a.storesWithPrices} עם מחירים
                    {a.storesApproximate > 0 && ` · ${a.storesApproximate} במיקום משוער (לפי עיר)`}
                  </div>
                )}
              </div>
              <details className="mt-2 text-sm" open={a.state === "failed" || retry.notfound === String(a.id)}>
                <summary className="cursor-pointer select-none text-link">תיקון הכתובת</summary>
                <form action={fixAddress} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={a.id} />
                  {retry.notfound === String(a.id) && (
                    <p role="alert" className="rounded-pm bg-missing-surface p-2.5 text-missing">
                      לא מצאנו את ״{retry.address}״. בודקים את האיות, וכותבים רחוב, מספר ועיר.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      name="address"
                      required
                      defaultValue={retry.notfound === String(a.id) ? retry.address : a.address}
                      aria-label={`הכתובת של ${a.label}`}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5"
                    />
                    <button className="rounded-lg border border-line px-3 py-1.5 font-medium">שמירה</button>
                  </div>
                </form>
              </details>
              <form action={updateRadius} className="mt-3 flex items-center gap-2 text-sm">
                <input type="hidden" name="id" value={a.id} />
                <label htmlFor={`radius-${a.id}`} className="text-muted">
                  רדיוס (ק״מ)
                </label>
                <input
                  id={`radius-${a.id}`}
                  name="radius"
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  max="50"
                  step="0.5"
                  defaultValue={a.radiusKm}
                  className="w-20 rounded-lg border border-line px-2 py-1.5"
                />
                <button className="rounded-lg border border-line px-3 py-1.5 font-medium">
                  עדכון
                </button>
              </form>
            </li>
          ))}
        </ul>

        {addresses.length >= MAX_ADDRESSES && (
          <p className="text-sm text-muted">אפשר לשמור עד {MAX_ADDRESSES} כתובות. כדי להוסיף כתובת, מוחקים אחת.</p>
        )}
        <form
          action={addAddress}
          className={`space-y-2 rounded-pm-lg border border-dashed border-line bg-card p-4 ${addresses.length >= MAX_ADDRESSES ? "hidden" : ""}`}
        >
          <div className="font-semibold">כתובת חדשה</div>
          {retry.notfound === "new" && (
            <p role="alert" className="rounded-pm bg-missing-surface p-2.5 text-sm text-missing">
              לא מצאנו את ״{retry.address}״, ולכן היא לא נשמרה. בודקים את האיות, וכותבים רחוב, מספר ועיר.
            </p>
          )}
          <input
            name="label"
            defaultValue={retry.notfound === "new" ? retry.label : undefined}
            placeholder="שם (בית, עבודה…)"
            className="w-full rounded-pm border border-line px-3 py-2.5"
          />
          <input
            name="address"
            required
            defaultValue={retry.notfound === "new" ? retry.address : undefined}
            placeholder="רחוב ומספר, עיר"
            className="w-full rounded-pm border border-line px-3 py-2.5"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="new-radius" className="text-sm text-muted">
              רדיוס (ק״מ)
            </label>
            <input
              id="new-radius"
              name="radius"
              type="number"
              inputMode="decimal"
              min="0.5"
              max="50"
              step="0.5"
              defaultValue={DEFAULT_RADIUS}
              className="w-20 rounded-pm border border-line px-2 py-2.5"
            />
            <button className="mr-auto rounded-pm bg-primary px-5 py-2.5 font-semibold text-on-primary">
              הוספה
            </button>
          </div>
        </form>
      </details>

      <details className="group space-y-3">
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 py-3 shadow-card">
          <h2 className="text-lg font-bold">מועדוני לקוחות</h2>
          <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">▾</span>
        </summary>
        <p className="text-sm text-muted">
          מבצע מועדון נכלל בחישוב רק אם סימנתם שאתם חברים. אחרת הוא מוצג כחיסכון אפשרי.
        </p>
        {clubs.length === 0 ? (
          <p className="rounded-pm-lg bg-card p-4 text-sm text-muted">עוד לא נטענו מבצעי מועדון.</p>
        ) : (
          <ul className="divide-y divide-subtle rounded-pm-lg border border-line bg-card shadow-card">
            {clubs.map((club) => (
              <li key={`${club.chainKey}-${club.clubId}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{club.chainName}</div>
                  <div className="truncate text-xs text-muted">{club.name}</div>
                </div>
                <form action={setClub}>
                  <input type="hidden" name="chain" value={club.chainKey} />
                  <input type="hidden" name="club" value={club.clubId} />
                  <input type="hidden" name="member" value={club.member ? "0" : "1"} />
                  <button
                    aria-pressed={club.member}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      club.member ? "bg-primary text-on-primary" : "border border-line text-muted"
                    }`}
                  >
                    {club.member ? "חבר/ה ✓" : "לא חבר/ה"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="group space-y-3">
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 py-3 shadow-card">
          <h2 className="text-lg font-bold">פיצול לשני סניפים</h2>
          <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">▾</span>
        </summary>
        <form
          action={updateSplitThreshold}
          className="flex items-center gap-2 rounded-pm-lg border border-line bg-card p-4 text-sm shadow-card"
        >
          <label htmlFor="threshold" className="flex-1 text-muted">
            להציע פיצול רק כשהוא חוסך לפחות (₪)
          </label>
          <input
            id="threshold"
            name="threshold"
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            step="1"
            defaultValue={threshold}
            className="w-20 rounded-lg border border-line px-2 py-1.5"
          />
          <button className="rounded-lg border border-line px-3 py-1.5 font-medium">עדכון</button>
        </form>
      </details>

      <details className="group space-y-3">
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 py-3 shadow-card">
          <h2 className="text-lg font-bold">תצוגה</h2>
          <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">▾</span>
        </summary>
        <form action={setTheme} className="flex gap-2 rounded-pm-lg border border-line bg-card p-4 shadow-card">
          {(["system", "light", "dark"] as const).map((value) => (
            <button
              key={value}
              name="theme"
              value={value}
              aria-pressed={theme === value}
              className={`min-h-11 flex-1 rounded-pm border px-3 text-sm font-bold ${
                theme === value ? "border-primary bg-primary text-on-primary" : "border-line text-ink"
              }`}
            >
              {value === "system" ? "לפי המכשיר" : value === "light" ? "בהיר" : "כהה"}
            </button>
          ))}
        </form>
      </details>

      <details className="group space-y-3">
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-pm-lg border border-line bg-card px-4 py-3 shadow-card">
          <h2 className="text-lg font-bold">רשתות וסטטוס טעינה</h2>
          <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">▾</span>
        </summary>
        <p className="text-sm text-muted">רשת מוסתרת לא מופיעה בחיפוש, בהשוואה ובפיצול.</p>
        <div className="rounded-pm-lg border border-line bg-card p-4 text-sm shadow-card">
          <div>
            {info.stores.toLocaleString("he-IL")} סניפים בארץ ·{" "}
            {info.geocoded.toLocaleString("he-IL")} עם מיקום
            {info.geocodePending > 0 && ` · ${info.geocodePending.toLocaleString("he-IL")} ממתינים לאיתור`}
          </div>
          {info.activeRequests.length > 0 && (
            <div className="mt-1 text-aging">
              בתהליך: {REQUEST_LABELS[info.activeRequests[0].kind] ?? info.activeRequests[0].kind}
              {info.activeRequests[0].status === "running" && info.activeRequests[0].message
                ? ` – ${info.activeRequests[0].message}`
                : ""}
              {info.activeRequests.length > 1 && ` · עוד ${info.activeRequests.length - 1} בקשות ממתינות`}
            </div>
          )}
          <div className="mt-1 text-muted">
            ריצה לילית כל יום ב-{info.nightlyTime} (שעון ישראל).{" "}
            {info.nightly?.startedAt
              ? `האחרונה: ${formatUpdated(info.nightly.startedAt)}${
                  info.nightly.status === "failed" ? " – נכשלה" : info.nightly.status === "running" ? " – רצה עכשיו" : ""
                }`
              : "עוד לא רצה."}
          </div>
          {info.nightly?.message && <div className="mt-1 text-xs text-muted">{info.nightly.message}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={requestPrices}>
              <button className="rounded-lg border border-line px-3 py-1.5 font-medium">
                טעינת מחירים עכשיו
              </button>
            </form>
            <form action={requestStores}>
              <button className="rounded-lg border border-line px-3 py-1.5 font-medium">
                רענון רשימות סניפים
              </button>
            </form>
          </div>
        </div>

        <ul className="divide-y divide-subtle rounded-pm-lg border border-line bg-card shadow-card">
          {chains.map((c) => (
            <ChainRow key={c.key} chain={c} />
          ))}
        </ul>
      </details>
    </div>
  );
}

function badge(c: ChainStatus): { text: string; className: string } {
  const run = c.pricesRun ?? c.storesRun;
  if (run?.status === "running") return { text: "בטעינה", className: "bg-info-surface text-info" };
  if (c.notUpdated) return { text: "לא עודכן", className: "bg-aging-surface text-aging" };
  if (!run) return { text: "טרם נטען", className: "bg-subtle text-muted" };
  if (run.status === "failed") return { text: "נכשל", className: "bg-missing-surface text-missing" };
  if (run.status === "partial") return { text: "חלקי", className: "bg-aging-surface text-aging" };
  return { text: "תקין", className: "bg-fresh-surface text-fresh" };
}

function runLine(label: string, run: RunInfo | null) {
  if (!run) return null;
  return (
    <div>
      {label}: {formatUpdated(run.startedAt)}
      {run.filesLoaded > 0 && ` · ${run.filesLoaded} קבצים`}
      {run.filesFailed > 0 && ` · ${run.filesFailed} כשלים`}
    </div>
  );
}

function ChainRow({ chain: c }: { chain: ChainStatus }) {
  const b = badge(c);
  const error = (c.pricesRun?.error ?? c.promosRun?.error ?? c.storesRun?.error)?.split("\n")[0];
  return (
    <li className="p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          {c.name}
          {c.isPharm && <span className="mr-2 text-xs font-normal text-muted">פארם</span>}
          {c.hidden && <span className="mr-2 text-xs font-normal text-missing">מוסתרת</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={toggleChain}>
            <input type="hidden" name="chain" value={c.key} />
            <input type="hidden" name="hidden" value={c.hidden ? "0" : "1"} />
            <button className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
              {c.hidden ? "הצגה" : "הסתרה"}
            </button>
          </form>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>{b.text}</span>
        </div>
      </div>
      <div className="mt-1 text-xs text-muted">
        <div>
          {c.stores} סניפים · {c.geocoded} עם מיקום · {c.storesWithPrices} עם מחירים
          {c.oldestPrices && ` (מ-${formatUpdated(c.oldestPrices)})`}
        </div>
        {runLine("רשימת סניפים", c.storesRun)}
        {runLine("מחירים", c.pricesRun)}
        {runLine("מבצעים", c.promosRun)}
        {error && <div className="mt-1 break-words text-missing">{error.slice(0, 160)}</div>}
      </div>
    </li>
  );
}
