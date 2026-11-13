"use client";

import { useRef, useState, useTransition } from "react";
import { addReceiptItems } from "@/app/receipt/actions";
import { listQuantity, preselected, type Candidate, type MatchedLine } from "@/lib/receipt-match";
import { Price } from "./ui";

type Line = MatchedLine & {
  key: number;
  /** המוצר שנבחר, או null לדילוג */
  chosen: number | null;
  /** כמות שהמשתמש הקליד; אחרת נגזרת מהחשבונית */
  typed: string | null;
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

const quantityOf = (line: Line, product: Candidate) =>
  line.typed != null ? Number(line.typed.replace(",", ".")) : listQuantity(line, product.isWeighted);

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
          (data.lines as MatchedLine[]).map((line, key) => ({ ...line, key, chosen: preselected(line), typed: null })),
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
    if (!product) return [];
    const quantity = quantityOf(line, product);
    return Number.isFinite(quantity) && quantity > 0 ? [{ productId: product.id, quantity }] : [];
  });
  const unsure = lines.filter((line) => line.chosen == null).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" role="status">
        זוהו {lines.length} שורות. {unsure > 0 ? `${unsure} מהן מחכות לבחירה שלך; שורה בלי בחירה לא תתווסף.` : "בודקים ומאשרים."}
      </p>
      <ul className="space-y-3">
        {lines.map((line) => (
          <LineCard key={line.key} line={line} update={(patch) => update(line.key, patch)} />
        ))}
      </ul>
      <button className="text-sm text-link" onClick={() => setLines(null)}>
        העלאת חשבונית אחרת
      </button>

      <div className="fixed inset-x-0 bottom-14 z-30 mb-[env(safe-area-inset-bottom)] border-t border-line bg-card/95 p-3 backdrop-blur">
        <button
          disabled={picked.length === 0 || saving}
          onClick={() => startSaving(() => addReceiptItems(picked))}
          className="mx-auto block w-full max-w-2xl rounded-pm bg-primary px-5 py-3 text-center font-bold text-on-primary disabled:opacity-50"
        >
          {saving ? "מוסיפים…" : picked.length === 0 ? "לא נבחרו מוצרים" : `הוספת ${picked.length} מוצרים לרשימה`}
        </button>
      </div>
    </div>
  );
}

const BADGE: Record<MatchedLine["confidence"], { text: string; className: string }> = {
  barcode: { text: "זוהה לפי ברקוד", className: "bg-fresh-surface text-fresh" },
  name: { text: "זוהה לפי שם", className: "bg-fresh-surface text-fresh" },
  loose: { text: "לא בטוח, לבחור", className: "bg-aging-surface text-aging" },
  none: { text: "לא נמצא במאגר", className: "bg-missing-surface text-missing" },
};

function LineCard({ line, update }: { line: Line; update: (patch: Partial<Line>) => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [empty, setEmpty] = useState(false);
  const product = line.candidates.find((c) => c.id === line.chosen);
  const badge = BADGE[line.confidence];

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
          minPrice: p.prices.length ? Math.min(...p.prices.map((x: { price: number }) => Number(x.price))) : null,
        }));
      if (candidates.length === 0) setEmpty(true);
      else update({ candidates, chosen: null, confidence: "loose", typed: null });
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
          <h2 className="font-semibold leading-snug">{line.printed || line.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            בחשבונית: {line.unit === "kg" ? `${line.quantity} ק״ג` : `${line.quantity} יח׳`}
            {line.total != null && (
              <>
                {" · "}
                <Price value={line.total} />
              </>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badge.className}`}>{badge.text}</span>
      </div>

      <fieldset className="mt-3 space-y-1 text-sm">
        <legend className="sr-only">בחירת מוצר עבור {line.printed || line.name}</legend>
        {line.candidates.map((candidate) => (
          <label key={candidate.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-pm px-2 py-1 has-[:checked]:bg-subtle">
            <input
              type="radio"
              name={`line-${line.key}`}
              checked={line.chosen === candidate.id}
              onChange={() => update({ chosen: candidate.id, typed: null })}
              className="size-5 shrink-0 accent-[var(--pm-primary)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block leading-snug">{candidate.name}</span>
              <span className="text-xs text-muted">
                {candidate.manufacturer}
                {candidate.isWeighted && " · שקיל"}
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
            className="size-5 shrink-0 accent-[var(--pm-primary)]"
          />
          דילוג, לא להוסיף
        </label>
      </fieldset>

      {product && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          כמות{product.isWeighted ? " (ק״ג)" : ""}
          <input
            inputMode="decimal"
            dir="ltr"
            value={line.typed ?? String(listQuantity(line, product.isWeighted))}
            onChange={(event) => update({ typed: event.target.value })}
            className="w-20 rounded-lg border border-line bg-card px-3 py-1.5 text-center"
          />
        </label>
      )}

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
            aria-label={`חיפוש מוצר עבור ${line.printed || line.name}`}
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
