import { COPY } from "@/lib/copy";
import { PARTIES, TOTAL_SEATS } from "@/lib/parties";
import Hemicycle, { segmentsFrom } from "./Hemicycle";

// מונה דביק: כנסת חיה שמתמלאת תוך כדי הזזת הסליידרים
export default function StickyCounter({ sum, seats }: { sum: number; seats: Record<string, number> }) {
  const ok = sum === TOTAL_SEATS;
  const over = sum > TOTAL_SEATS;
  const msg = over ? COPY.sumOver(sum) : sum < TOTAL_SEATS ? COPY.sumUnder(TOTAL_SEATS - sum) : null;
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pb-2 pt-2 backdrop-blur">
      <div
        className="box flex items-center gap-3 px-3 py-2"
        style={{ borderColor: ok ? "rgb(30 229 138 / 0.6)" : "rgb(255 45 85 / 0.55)" }}
        role="status"
        aria-live="polite"
      >
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-none text-muted">מנדטים</div>
          <div key={sum} className={`font-display text-4xl leading-tight tabular-nums ${ok ? "glow-ok" : "glow-red"}`} style={{ animation: "pop 0.25s" }}>
            {sum}
            <span className="text-2xl text-muted">/120</span>
          </div>
          {msg && <div className="text-sm leading-snug text-fg/90">{msg}</div>}
        </div>
        <Hemicycle
          segments={segmentsFrom(seats, PARTIES)}
          overflow={Math.max(0, sum - TOTAL_SEATS)}
          className="w-[150px] shrink-0 sm:w-[190px]"
          title={COPY.seatCounter(sum)}
        />
        <span className="sr-only">{COPY.seatCounter(sum)}</span>
      </div>
    </div>
  );
}
