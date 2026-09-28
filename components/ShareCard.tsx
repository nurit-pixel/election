"use client";

import { forwardRef } from "react";
import { COPY } from "@/lib/copy";
import { PARTY_BY_KEY } from "@/lib/parties";
import type { Bet } from "@/lib/scoring";
import PartyImage from "./PartyImage";

export function pmLabel(pm: string): string {
  if (pm === "none") return COPY.pmNone;
  if (pm.startsWith("other:")) return pm.slice(6);
  const p = PARTY_BY_KEY[pm];
  return p ? p.leader || p.name : pm;
}

export function topParties(bet: Bet, n = 3) {
  return Object.entries(bet.seats)
    .filter(([k, v]) => v > 0 && PARTY_BY_KEY[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ party: PARTY_BY_KEY[k], seats: v }));
}

const DISPLAY = "var(--font-secular), 'Secular One', sans-serif";
const BODY = "var(--font-assistant), Assistant, sans-serif";

// ריבוע 1080×1080 בסגנון מסך שידור של ליל בחירות. מוצג מוקטן; html-to-image מצלם את הצומת בגודל המלא.
const ShareCard = forwardRef<HTMLDivElement, { name: string; bet: Bet }>(function ShareCard({ name, bet }, ref) {
  const top = topParties(bet);
  const max = Math.max(1, ...top.map((t) => t.seats));
  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: 1080,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        color: "#eef2ff",
        fontFamily: BODY,
        background:
          "radial-gradient(700px 420px at 100% 0%, rgba(34,211,238,0.22), transparent 60%), radial-gradient(700px 480px at 0% 10%, rgba(255,45,85,0.25), transparent 60%), #060a18",
        boxSizing: "border-box",
        padding: 64,
        display: "flex",
        flexDirection: "column",
        gap: 34,
      }}
    >
      {/* רשת רקע */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(125,160,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(125,160,255,0.07) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
        }}
      />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 58, lineHeight: 1 }}>
          מטה המאבק{" "}
          <span style={{ color: "#ff2d55", textShadow: "0 0 30px rgba(255,45,85,0.7)" }}>כוח 43</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            border: "2px solid rgba(255,45,85,0.7)",
            borderRadius: 999,
            padding: "8px 24px",
            fontFamily: DISPLAY,
            fontSize: 32,
            background: "rgba(255,45,85,0.14)",
          }}
        >
          <span style={{ width: 18, height: 18, borderRadius: 999, background: "#ff2d55", boxShadow: "0 0 18px #ff2d55" }} />
          <span style={{ color: "#ff2d55" }}>LIVE</span>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 34, color: "#93a0c8" }}>התחזית של</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 110, lineHeight: 1, textShadow: "0 0 40px rgba(34,211,238,0.35)" }}>{name}</div>
      </div>

      <div
        style={{
          position: "relative",
          border: "2px solid rgba(34,211,238,0.5)",
          borderRadius: 24,
          padding: "22px 32px",
          background: "rgba(34,211,238,0.08)",
          boxShadow: "0 0 40px rgba(34,211,238,0.18)",
        }}
      >
        <div style={{ fontSize: 30, color: "#93a0c8" }}>{COPY.shareCardPm}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 64, lineHeight: 1.1, color: "#22d3ee", textShadow: "0 0 24px rgba(34,211,238,0.6)" }}>
          {pmLabel(bet.pm)}
        </div>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 30, color: "#93a0c8" }}>{COPY.shareCardTop3}</div>
        {top.map(({ party, seats }) => (
          <div key={party.key} style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <PartyImage partyKey={party.key} size={70} />
            <div style={{ width: 300, fontFamily: DISPLAY, fontSize: 44, whiteSpace: "nowrap", overflow: "hidden" }}>{party.name}</div>
            <div style={{ flex: 1, height: 26, borderRadius: 999, background: "rgba(125,160,255,0.15)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(seats / max) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: party.color,
                  boxShadow: `0 0 20px ${party.color}`,
                }}
              />
            </div>
            <div style={{ width: 110, textAlign: "center", fontFamily: DISPLAY, fontSize: 64, lineHeight: 1 }}>{seats}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          height: 60,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(125,160,255,0.25)",
          background: "rgba(6,10,24,0.8)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "0 24px", background: "#ff2d55", fontFamily: DISPLAY, fontSize: 30 }}>
          {COPY.tickerLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 24px", fontSize: 28, color: "#eef2ff" }}>
          {COPY.subtitle} · {COPY.shareCardFooter}
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
