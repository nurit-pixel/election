import { COPY } from "@/lib/copy";
import { TOTAL_SEATS } from "@/lib/parties";

export default function StickyCounter({ sum }: { sum: number }) {
  const ok = sum === TOTAL_SEATS;
  const over = sum > TOTAL_SEATS;
  const msg = over ? COPY.sumOver(sum) : sum < TOTAL_SEATS ? COPY.sumUnder(TOTAL_SEATS - sum) : null;
  const pct = Math.min(100, (sum / TOTAL_SEATS) * 100);
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pb-2 pt-2 backdrop-blur">
      <div
        className="box px-4 py-2"
        style={{ borderColor: ok ? "rgb(30 229 138 / 0.6)" : "rgb(255 45 85 / 0.55)" }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl">מנדטים</span>
          <span key={sum} className={`font-display text-4xl tabular-nums ${ok ? "glow-ok" : "glow-red"}`} style={{ animation: "pop 0.25s" }}>
            {sum}
            <span className="text-2xl text-muted">/120</span>
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${pct}%`,
              marginInlineStart: 0,
              background: ok ? "var(--color-ok)" : over ? "var(--color-accent)" : "linear-gradient(to left, var(--color-cyan), var(--color-accent))",
              boxShadow: `0 0 12px ${ok ? "var(--color-ok)" : "var(--color-accent)"}`,
            }}
          />
        </div>
        {msg && <div className="mt-1 text-base leading-snug text-fg/90">{msg}</div>}
        <span className="sr-only">{COPY.seatCounter(sum)}</span>
      </div>
    </div>
  );
}
