"use client";

import { forwardRef } from "react";
import { COPY } from "@/lib/copy";
import type { Bet } from "@/lib/scoring";
import PartyImage from "./PartyImage";
import Hemicycle, { segmentsFrom } from "./Hemicycle";
import { PARTIES } from "@/lib/parties";
import { pmLabel, topParties } from "@/lib/betLabels";

export { pmLabel, topParties } from "@/lib/betLabels";

const DISPLAY = "var(--font-secular), 'Secular One', sans-serif";
const BODY = "var(--font-assistant), Assistant, sans-serif";

// ריבוע 1080×1080 בסגנון מסך שידור של ליל בחירות. מוצג מוקטן; html-to-image מצלם את הצומת בגודל המלא.
const ShareCard = forwardRef<HTMLDivElement, { name: string; bet: Bet }>(function ShareCard({ name, bet }, ref) {
  const top = topParties(bet);
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
          {COPY.brandA}{" "}
          <span style={{ color: "#ff2d55", textShadow: "0 0 30px rgba(255,45,85,0.7)" }}>{COPY.brandB}</span>
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

      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 36 }}>
        <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 30, color: "#93a0c8" }}>{COPY.shareCardTop3}</div>
          {top.map(({ party, seats }) => (
            <div key={party.key} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <PartyImage partyKey={party.key} size={62} />
              <div style={{ flex: 1, fontFamily: DISPLAY, fontSize: 40, whiteSpace: "nowrap", overflow: "hidden" }}>{party.name}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 58, lineHeight: 1, color: party.color, textShadow: `0 0 18px ${party.color}` }}>{seats}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <Hemicycle segments={segmentsFrom(bet.seats, PARTIES)} center="120" sub="מושבים" className="w-full" title="הכנסת שלי" />
        </div>
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
