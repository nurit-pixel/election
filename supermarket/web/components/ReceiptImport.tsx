"use client";

import { useRef, useState, useTransition } from "react";
import { addReceiptItems } from "@/app/receipt/actions";
import { preselected, type Candidate, type MatchedLine } from "@/lib/receipt-match";
import { Price } from "./ui";

type Line = MatchedLine & {
  key: number;
  /** המוצר שנבחר, או null לדילוג */
  chosen: number | null;
};

const MAX_SIDE = 2200;

/** תמונה מהטלפון נשלחת מוקטנת: מהיר יותר, ומספיק חד לקריאת חשבונית. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function ReceiptImport() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [saving, startSaving] = useTransition();

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      const blob = await shrink(file);
      body.append("file", blob, blob === file ? file.name : "receipt.jpg");
      const response = await fetch("/api/receipt", { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.lines) {
        setError(data?.error ?? "קריאת החשבונית נכשלה. מנסים שוב בעוד רגע.");
      } else if (data.lines.length === 0) {
        setError("לא זיהינו מוצרים בקובץ. מנסים צילום חד יותר, שכל החשבונית נראית בו.");
      } else {
        setLines(
          (data.lines as MatchedLine[]).map((line, key) => ({ ...line, key, chosen: preselected(line) })),
        );
      }
    } catch {
      setError("אין חיבור לשרת. בודקים את הרשת ומנסים שוב.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current && current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  if (!lines) {
    return (
      <div className="space-y-3">
        <label
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-pm-lg border-2 border-dashed border-line bg-card p-6 text-center shadow-card ${
            busy ? "pointer-events-none opacity-70" : ""
          }`}
        >
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className="rounded-pm bg-primary px-5 py-3 font-bold text-on-primary">
            {busy ? "קוראים את החשבונית…" : "צילום או בחירת קובץ"}
          </span>
          <span className="text-sm text-muted" role="status">
            {busy ? "זה לוקח עד חצי דקה. לא סוגרים את המסך." : "תמונה או PDF, עד 10MB"}
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-pm-lg border border-missing/40 bg-missing-surface p-3 text-sm text-missing">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">
          הקובץ מעובד בשרת שלך בלבד, לא נשלח לשום גורם חיצוני ונמחק מיד אחרי הקריאה. דבר לא נכנס לרשימה לפני שמאשרים.
        </p>
      </div>
    );
  }

  const picked = lines.flatMap((line) => {
    const product = line.candidates.find((c) => c.id === line.chosen);
    return product ? [product.id] : [];
  });
  // שורות שלא נמצא להן מוצר במאגר מוצגות בנפרד, מקופלות: לרוב הן טקסט שאינו מוצר
  const found = lines.filter((line) => line.confidence !== "none");
  const unknown = lines.filter((line) => line.confidence === "none");
  const unsure = lines.filter((line) => line.chosen == null).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" role="status">
        זוהו {found.length} מוצרים.{" "}
        {found.some((line) => line.chosen == null) ? "מוצר בלי בחירה לא יתווסף." : "בודקים ומאשרים."} כל מוצר נכנס לרשימה
        בכמות 1.
      </p>
      <ul className="space-y-3">
        {found.map((line) => (
          <LineCard key={line.key} line={line} update={(patch) => update(line.key, patch)} />
        ))}
      </ul>
      {found.length === 0 && (
        <p className="rounded-pm-lg border border-line bg-card p-4 text-sm text-muted">
          אף שורה בחשבונית לא תואמת מוצר במאגר. אפשר לחפש ידנית בשורות שלמטה, או לנסות צילום חד יותר.
        </p>
      )}
      {unknown.length > 0 && (
        <details className="rounded-pm-lg border border-line bg-card p-3 text-sm">
          <summary className="cursor-pointer select-none font-bold text-link">
            {unknown.length} שורות שלא זוהו כמוצר במאגר
          </summary>
          <p className="mt-1 text-muted">לרוב זה טקסט אחר מהחשבונית. אם זה בכל זאת מוצר, אפשר לחפש אותו כאן.</p>
          <ul className="mt-3 space-y-3">
            {unknown.map((line) => (
              <LineCard key={line.key} line={line} update={(patch) => update(line.key, patch)} />
            ))}
          </ul>
        </details>
      )}
      <button className="text-sm text-link" onClick={() => setLines(null)}>
        העלאת חשבונית אחרת
      </button>

      <div className="fixed inset-x-0 bottom-[78px] z-30 mb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-canvas from-80% to-transparent px-4 pb-3 pt-4">
        <button
          disabled={picked.length === 0 || saving}
          onClick={() => startSaving(() => addReceiptItems(picked))}
          className="mx-auto block w-full max-w-2xl rounded-pm bg-primary pm-cta px-5 py-3 text-center font-bold text-on-primary disabled:opacity-50"
        >
          {saving ? "מוסיפים…" : picked.length === 0 ? "לא נבחרו מוצרים" : `הוספת ${picked.length} מוצרים לרשימה`}
        </button>
      </div>
    </div>
  );
}

const BADGE: Record<MatchedLine["confidence"], { text: string; className: string }> = {
  barcode: { text: "זוהה לפי קוד", className: "bg-fresh-surface text-fresh" },
  name: { text: "זוהה לפי שם", className: "bg-fresh-surface text-fresh" },
  loose: { text: "לא בטוח, לבחור", className: "bg-aging-surface text-aging" },
  none: { text: "לא נמצא במאגר", className: "bg-missing-surface text-missing" },
};

function LineCard({ line, update }: { line: Line; update: (patch: Partial<Line>) => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [empty, setEmpty] = useState(false);
  const badge = BADGE[line.confidence];
  // מוצר שזוהה לפי קוד מוצג בשמו במאגר: בצילום, השם שנקרא מהחשבונית לרוב משובש
  const title =
    (line.confidence === "barcode" && line.candidates[0]?.name) ||
    line.printed ||
    line.name ||
    (line.barcode ? `קוד ${line.barcode}` : "שורה מהחשבונית");

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setEmpty(false);
    try {
      const data = await (await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)).json();
      const candidates: Candidate[] = (data.results as any[])
        .filter((p) => !p.internal)
        .slice(0, 6)
        .map((p) => ({
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          isWeighted: p.isWeighted,
          chainName: null,
          minPrice: p.prices.length ? Math.min(...p.prices.map((x: { price: number }) => Number(x.price))) : null,
        }));
      if (candidates.length === 0) setEmpty(true);
      else update({ candidates, chosen: null, confidence: "loose" });
    } catch {
      setEmpty(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <li className="rounded-pm-lg border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">
            בחשבונית:{" "}
            {line.total != null && <Price value={line.total} />}
            {line.total != null && line.barcode && " · "}
            {line.barcode && (
              <>
                קוד <span dir="ltr">{line.barcode}</span>
              </>
            )}
            {line.total == null && !line.barcode && "בלי קוד ובלי מחיר"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badge.className}`}>{badge.text}</span>
      </div>

      <fieldset className="mt-3 space-y-1 text-sm">
        <legend className="sr-only">בחירת מוצר עבור {title}</legend>
        {line.candidates.map((candidate) => (
          <label key={candidate.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-pm px-2 py-1 has-[:checked]:bg-subtle">
            <input
              type="radio"
              name={`line-${line.key}`}
              checked={line.chosen === candidate.id}
              onChange={() => update({ chosen: candidate.id })}
              className="size-5 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block leading-snug">{candidate.name}</span>
              <span className="text-xs text-muted">
                {candidate.manufacturer}
                {candidate.isWeighted && " · שקיל"}
                {candidate.chainName && ` · רק ב${candidate.chainName}`}
              </span>
            </span>
            {candidate.minPrice != null && (
              <span className="shrink-0 text-xs text-muted">
                מ-<Price value={candidate.minPrice} />
              </span>
            )}
          </label>
        ))}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-pm px-2 py-1 text-muted has-[:checked]:bg-subtle">
          <input
            type="radio"
            name={`line-${line.key}`}
            checked={line.chosen == null}
            onChange={() => update({ chosen: null })}
            className="size-5 shrink-0"
          />
          דילוג, לא להוסיף
        </label>
      </fieldset>


      <details className="mt-2 text-sm" open={line.confidence === "none"}>
        <summary className="cursor-pointer select-none text-link">חיפוש מוצר אחר</summary>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            enterKeyHint="search"
            placeholder="שם מוצר או ברקוד"
            aria-label={`חיפוש מוצר עבור ${title}`}
            className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5"
          />
          <button disabled={searching} className="rounded-lg border border-line px-3 py-1.5 font-medium">
            {searching ? "מחפשים…" : "חיפוש"}
          </button>
        </form>
        {empty && <p className="mt-1 text-xs text-missing">לא נמצאו מוצרים. מנסים ניסוח אחר.</p>}
      </details>
    </li>
  );
}
