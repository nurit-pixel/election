/** דירוג בכוכבים לתצוגה. מקריא את הדירוג במילים. */
export function Stars({ value, count, className = "" }: { value: number; count?: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`דירוג ${value} מתוך 5${count != null ? `, ${count} חוות דעת` : ""}`}>
      <span aria-hidden className="tracking-tight text-pm-orange">
        {"★".repeat(full)}
        <span className="text-line">{"★".repeat(5 - full)}</span>
      </span>
      <span aria-hidden className="text-xs font-bold tabular-nums">
        {value.toFixed(1)}
        {count != null && <span className="font-normal text-muted"> ({count})</span>}
      </span>
    </span>
  );
}
