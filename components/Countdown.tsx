"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";

export default function Countdown({ lockAt, className = "" }: { lockAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // לפני hydration לא מציגים כלום כדי להימנע מאי-התאמה בין שרת ללקוח
  if (now === null) return <p className={`min-h-[1.5em] ${className}`} aria-hidden />;

  const ms = new Date(lockAt).getTime() - now;
  if (ms <= 0) return <p className={`font-display text-accent ${className}`}>{COPY.locked}</p>;

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return (
    <p className={`font-display ${className}`} role="timer">
      {COPY.countdown(d, h)}
    </p>
  );
}
