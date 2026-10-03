"use client";

import { useMemo } from "react";

const COLORS = ["#ff2d55", "#22d3ee", "#1ee58a", "#ffd166", "#eef2ff", "#a78bfa"];

// אנימציית שליחה: הפתק מתקפל ונופל לקלפי, חותמת "הצביע/ה" וקונפטי. ~1.8 שניות.
export default function BallotDrop({ letters }: { letters: string }) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: 0.9 + Math.random() * 0.5,
        dur: 1.4 + Math.random() * 1.2,
        dx: `${(Math.random() - 0.5) * 30}vw`,
        rot: `${Math.random() * 720 - 360}deg`,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
      })),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-bg/85 backdrop-blur-sm"
      style={{ animation: "fade-in 0.2s" }}
      role="status"
      aria-live="assertive"
    >
      <span className="sr-only">ההימור נשלח</span>
      <div className="relative h-[320px] w-[260px]">
        {/* הפתק */}
        <div
          className="absolute left-1/2 top-[70px] z-10 flex h-[120px] w-[90px] items-center justify-center rounded-md border border-white/60 bg-[#f5f7ff] font-display text-4xl text-[#0e1531] shadow-[0_0_30px_rgb(255_255_255/0.4)]"
          style={{ animation: "ballot-drop 1s cubic-bezier(.5,0,.6,1) forwards", transformOrigin: "50% 100%" }}
        >
          {letters}
        </div>
        {/* הקלפי */}
        <div className="absolute bottom-0 left-1/2 z-20 h-[150px] w-[210px] -translate-x-1/2 rounded-xl border border-cyan/60 bg-gradient-to-b from-[#1b2a5c] to-[#0e1531] shadow-[0_0_40px_rgb(34_211_238/0.35)]">
          <div className="mx-auto mt-4 h-2 w-[120px] rounded-full bg-black shadow-[inset_0_1px_3px_rgb(0_0_0/0.9),0_0_10px_rgb(34_211_238/0.5)]" />
          <div className="mt-8 text-center font-display text-2xl text-cyan/80">ליל המדגמים</div>
        </div>
        {/* חותמת */}
        <div
          className="absolute left-1/2 top-[45%] z-30 whitespace-nowrap rounded-xl border-4 border-accent px-4 py-1 font-display text-4xl text-accent opacity-0 shadow-[0_0_30px_rgb(255_45_85/0.6)]"
          style={{ animation: "stamp-in 0.35s 1s ease-out forwards", background: "rgb(6 10 24 / 0.85)" }}
        >
          הצביע/ה ✓
        </div>
      </div>
      {confetti.map((c, i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-0 rounded-[2px]"
          style={{
            left: `${c.left}%`,
            width: c.w,
            height: c.h,
            background: c.color,
            boxShadow: `0 0 6px ${c.color}`,
            opacity: 0,
            animation: `confetti-fall ${c.dur}s ${c.delay}s ease-in forwards`,
            ["--dx" as string]: c.dx,
            ["--rot" as string]: c.rot,
          }}
        />
      ))}
    </div>
  );
}
