"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";

const pad = (n: number) => String(n).padStart(2, "0");

// שעון ספירה לאחור בסגנון לוח תוצאות
export default function Countdown({ lockAt, className = "" }: { lockAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // לפני hydration לא מציגים כלום כדי להימנע מאי-התאמה בין שרת ללקוח
  if (now === null) return <div className={`min-h-[88px] ${className}`} aria-hidden />;

  const ms = new Date(lockAt).getTime() - now;
  if (ms <= 0) return <p className={`font-display text-2xl glow-red ${className}`}>{COPY.locked}</p>;

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cells: [string, string][] = [
    [String(d), "ימים"],
    [pad(h), "שעות"],
    [pad(m), "דקות"],
    [pad(s), "שניות"],
  ];

  return (
    <div className={className} role="timer" aria-label={COPY.countdown(d, h)}>
      <p className="mb-2 text-center text-base text-muted">הפתק נסגר בעוד</p>
      <div className="flex justify-center gap-2" dir="rtl">
        {cells.map(([v, label]) => (
          <div key={label} className="box min-w-[70px] px-2 py-1.5 text-center">
            <div className="font-display text-4xl tabular-nums glow-cyan">{v}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
