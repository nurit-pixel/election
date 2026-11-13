import { freshnessText, spokenPrice, type Freshness } from "@/lib/freshness";

/** מחיר: מבודד משמאל לימין, ספרות ברוחב קבוע, ושם נגיש מלא */
export function Price({ value, className = "", unit }: { value: number; className?: string; unit?: string }) {
  return (
    <span className={`pm-price ${className}`} dir="ltr" aria-label={spokenPrice(value) + (unit ? ` ${unit}` : "")}>
      ₪{value.toFixed(2)}
    </span>
  );
}

const TONE: Record<Freshness, string> = {
  fresh: "text-fresh",
  aging: "text-aging",
  stale: "text-missing",
  unknown: "text-missing",
};

/** רעננות מחיר: נקודה, ניסוח וחותמת זמן מדויקת. המצב לא מועבר בצבע בלבד. */
export function FreshnessLine({
  status,
  observedAt,
  now,
  className = "",
}: {
  status: Freshness;
  observedAt: string | null;
  now: Date;
  className?: string;
}) {
  const exact = observedAt
    ? new Date(observedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })
    : undefined;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE[status]} ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {observedAt ? (
        <time dateTime={observedAt} title={exact}>
          {freshnessText(status, observedAt, now)}
        </time>
      ) : (
        freshnessText(status, observedAt, now)
      )}
    </span>
  );
}

/** סמל המד של פראיירמטר */
export function LogoMark({ size = 32 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-mark.svg" alt="" aria-hidden width={size} height={Math.round(size * 0.75)} />;
}

/** הקמע (פריי). דקורטיבי: עד פעם אחת במסך, ולעולם לא במקום טקסט מסביר. */
export function Mascot({ size = 96 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mascot-neutral.svg" alt="" aria-hidden width={size} height={Math.round(size * 1.125)} />;
}
