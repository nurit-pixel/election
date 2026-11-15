import { METER_COLORS, METER_LABELS } from "@/lib/meter";

/** המד מהלוגו: חמישה מקטעים מהזול ליקר, והמקטע של הסניף מודגש. */
export function Meter({ level, className = "" }: { level: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="img" aria-label={`מד המחיר: ${METER_LABELS[level]}`}>
      <div aria-hidden className="flex flex-1 gap-1" dir="rtl">
        {METER_COLORS.map((color, i) => (
          <span
            key={color}
            className={`h-2 flex-1 rounded-full ${i === level ? "ring-2 ring-[var(--pm-button-edge)] ring-offset-1 ring-offset-[var(--pm-card)]" : ""}`}
            style={{ background: color, opacity: i === level ? 1 : 0.28 }}
          />
        ))}
      </div>
      <span aria-hidden className="shrink-0 text-[11px] font-bold" style={{ color: level === 2 ? undefined : METER_COLORS[level] }}>
        <span className="rounded-md px-1.5 py-0.5 text-pm-purple" style={{ background: METER_COLORS[level] }}>
          {METER_LABELS[level]}
        </span>
      </span>
    </div>
  );
}
