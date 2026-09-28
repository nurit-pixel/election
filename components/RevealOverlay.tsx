"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";

type Mode = "none" | "exit_poll" | "official";

const KEY = "k43-revealed";
const TITLES: Record<Exclude<Mode, "none">, string> = {
  exit_poll: "המדגמים כאן!",
  official: "התוצאות הרשמיות!",
};

// מסך "מבזק" עם ספירה 3-2-1 — פעם אחת לכל מצב, בכל מכשיר
export default function RevealOverlay({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<number | null>(null); // 3,2,1 → 0 = כותרת

  useEffect(() => {
    if (mode === "none") return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {}
    if (seen.includes(mode)) return;
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen, mode]));
    } catch {}
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    setStep(3);
    const timers = [
      setTimeout(() => setStep(2), 800),
      setTimeout(() => setStep(1), 1600),
      setTimeout(() => setStep(0), 2400),
      setTimeout(() => setStep(null), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mode]);

  if (step === null || mode === "none") return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg/95 backdrop-blur"
      style={{ animation: "fade-in 0.2s" }}
      onClick={() => setStep(null)}
      role="status"
      aria-live="assertive"
    >
      <div className="chip mb-8 border-accent/60 bg-accent/15 px-4 py-1 font-display text-xl">
        <span className="live-dot" />
        <span className="glow-red">{COPY.tickerLabel}</span>
      </div>
      {step > 0 ? (
        <div key={step} className="font-display text-[160px] leading-none glow-cyan" style={{ animation: "count-pop 0.8s forwards" }}>
          {step}
        </div>
      ) : (
        <div className="px-6 text-center" style={{ animation: "count-pop 1.8s forwards" }}>
          <div className="font-display text-6xl leading-tight glow-red">{TITLES[mode]}</div>
          <div className="mt-3 text-xl text-muted">{mode === "exit_poll" ? COPY.exitPollLabel : "הדירוג הסופי"}</div>
        </div>
      )}
      <div className="absolute bottom-16 text-sm text-muted">הקישו כדי לדלג</div>
    </div>
  );
}
