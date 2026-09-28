import { COPY } from "@/lib/copy";

// פס "מבזק" רץ בתחתית המסך, כמו באולפן חדשות. התוכן משוכפל כדי שהלולאה תהיה רציפה.
export default function Ticker() {
  const items = [...COPY.ticker, ...COPY.ticker];
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex h-10 items-stretch border-t border-line bg-bg/95 backdrop-blur"
      aria-hidden
    >
      <div className="z-10 flex shrink-0 items-center gap-2 bg-accent px-3 font-display text-white shadow-[0_0_20px_rgb(255_45_85/0.6)]">
        <span className="live-dot bg-white" />
        {COPY.tickerLabel}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex w-max items-center" style={{ animation: "ticker 60s linear infinite" }}>
          {items.map((t, i) => (
            <span key={i} className="whitespace-nowrap px-6 text-base text-fg">
              {t} <span className="px-3 text-accent">▸</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
