import { COPY } from "@/lib/copy";
import { TOTAL_SEATS } from "@/lib/parties";

export default function StickyCounter({ sum }: { sum: number }) {
  const ok = sum === TOTAL_SEATS;
  const msg = sum > TOTAL_SEATS ? COPY.sumOver(sum) : sum < TOTAL_SEATS ? COPY.sumUnder(TOTAL_SEATS - sum) : null;
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pb-2 pt-2" style={{ background: "var(--color-cream)" }}>
      <div
        className="box px-4 py-2 text-white"
        style={{ background: ok ? "var(--color-ok)" : "var(--color-accent)" }}
        role="status"
        aria-live="polite"
      >
        <div className="font-display text-3xl tabular-nums">{COPY.seatCounter(sum)}</div>
        {msg && <div className="text-base leading-snug">{msg}</div>}
      </div>
    </div>
  );
}
