import { chainStatuses, listAddresses, overview, type ChainStatus, type RunInfo } from "@/lib/settings";
import { formatUpdated } from "@/lib/format";
import { addAddress, deleteAddress, requestPrices, requestStores, updateRadius } from "./actions";

export const dynamic = "force-dynamic";

const DEFAULT_RADIUS = Number(process.env.DEFAULT_RADIUS_KM ?? 5);
const REQUEST_LABELS: Record<string, string> = {
  address: "טעינת סניפים ליד כתובת",
  stores: "רענון רשימות סניפים",
  prices: "טעינת מחירים",
};

export default async function SettingsPage() {
  const [addresses, chains, info] = await Promise.all([listAddresses(), chainStatuses(), overview()]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-lg font-bold">כתובות ורדיוס</h1>
        <p className="text-sm text-slate-500">
          מחירים נטענים רק לסניפים שברדיוס מהכתובות השמורות. הוספת כתובת מפעילה טעינה מיידית.
        </p>

        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{a.label}</div>
                  {a.label !== a.address && (
                    <div className="truncate text-sm text-slate-500">{a.address}</div>
                  )}
                </div>
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-sm text-rose-600">מחיקה</button>
                </form>
              </div>
              <div className="mt-2 text-sm">
                {a.state === "pending" && <span className="text-slate-500">מאתר את הכתובת…</span>}
                {a.state === "failed" && (
                  <span className="text-rose-600">הכתובת לא נמצאה. נסו לכתוב רחוב, מספר ועיר.</span>
                )}
                {a.state === "ok" && (
                  <span className="text-slate-600">
                    {a.storesInRadius} סניפים ברדיוס · {a.storesWithPrices} עם מחירים
                    {a.storesApproximate > 0 && ` · ${a.storesApproximate} במיקום משוער (לפי עיר)`}
                  </span>
                )}
              </div>
              <form action={updateRadius} className="mt-3 flex items-center gap-2 text-sm">
                <input type="hidden" name="id" value={a.id} />
                <label htmlFor={`radius-${a.id}`} className="text-slate-500">
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
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
                />
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">
                  עדכון
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addAddress} className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <div className="font-semibold">כתובת חדשה</div>
          <input
            name="label"
            placeholder="שם (בית, עבודה…)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
          <input
            name="address"
            required
            placeholder="רחוב ומספר, עיר"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="new-radius" className="text-sm text-slate-500">
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
              className="w-20 rounded-xl border border-slate-300 px-2 py-2.5"
            />
            <button className="mr-auto rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white">
              הוספה
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">סטטוס טעינה</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div>
            {info.stores.toLocaleString("he-IL")} סניפים בארץ ·{" "}
            {info.geocoded.toLocaleString("he-IL")} עם מיקום
            {info.geocodePending > 0 && ` · ${info.geocodePending.toLocaleString("he-IL")} ממתינים לאיתור`}
          </div>
          {info.activeRequests.length > 0 && (
            <div className="mt-1 text-amber-700">
              בתהליך:{" "}
              {info.activeRequests.map((r) => REQUEST_LABELS[r.kind] ?? r.kind).join(", ")}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={requestPrices}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">
                טעינת מחירים עכשיו
              </button>
            </form>
            <form action={requestStores}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">
                רענון רשימות סניפים
              </button>
            </form>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {chains.map((c) => (
            <ChainRow key={c.key} chain={c} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function badge(c: ChainStatus): { text: string; className: string } {
  const run = c.pricesRun ?? c.storesRun;
  if (run?.status === "running") return { text: "בטעינה", className: "bg-sky-100 text-sky-800" };
  if (c.notUpdated) return { text: "לא עודכן", className: "bg-amber-100 text-amber-800" };
  if (!run) return { text: "טרם נטען", className: "bg-slate-100 text-slate-600" };
  if (run.status === "failed") return { text: "נכשל", className: "bg-rose-100 text-rose-800" };
  if (run.status === "partial") return { text: "חלקי", className: "bg-amber-100 text-amber-800" };
  return { text: "תקין", className: "bg-emerald-100 text-emerald-800" };
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
  const error = (c.pricesRun?.error ?? c.storesRun?.error)?.split("\n")[0];
  return (
    <li className="p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          {c.name}
          {c.isPharm && <span className="mr-2 text-xs font-normal text-slate-400">פארם</span>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>
          {b.text}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        <div>
          {c.stores} סניפים · {c.geocoded} עם מיקום · {c.storesWithPrices} עם מחירים
          {c.oldestPrices && ` (מ-${formatUpdated(c.oldestPrices)})`}
        </div>
        {runLine("רשימת סניפים", c.storesRun)}
        {runLine("מחירים", c.pricesRun)}
        {error && <div className="mt-1 break-words text-rose-700">{error.slice(0, 160)}</div>}
      </div>
    </li>
  );
}
