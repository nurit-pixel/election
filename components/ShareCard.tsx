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

// ריבוע 1080×1080 בעיצוב פתק הצבעה. מוצג מוקטן; html-to-image מצלם את הצומת בגודל המלא.
const ShareCard = forwardRef<HTMLDivElement, { name: string; bet: Bet }>(function ShareCard({ name, bet }, ref) {
  const top = topParties(bet);
  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: 1080,
        height: 1080,
        background: "#F5EFE0",
        color: "#1B2A49",
        fontFamily: "var(--font-assistant), Assistant, sans-serif",
        padding: 56,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: "100%",
          border: "10px solid #000",
          borderRadius: 18,
          background: "#fffdf7",
          padding: "44px 56px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-secular), 'Secular One', sans-serif", fontSize: 70, lineHeight: 1 }}>
              מטה המאבק
            </div>
            <div
              style={{
                fontFamily: "var(--font-secular), 'Secular One', sans-serif",
                fontSize: 70,
                lineHeight: 1.1,
                color: "#D62828",
              }}
            >
              כוח 43
            </div>
          </div>
          <div
            style={{
              border: "6px solid #D62828",
              color: "#D62828",
              borderRadius: 12,
              padding: "8px 20px",
              fontFamily: "var(--font-secular), 'Secular One', sans-serif",
              fontSize: 40,
              transform: "rotate(-8deg)",
              marginTop: 12,
            }}
          >
            הצביע/ה ✓
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-secular), 'Secular One', sans-serif", fontSize: 80, lineHeight: 1 }}>
          {name}
        </div>

        <div style={{ borderTop: "5px dashed #000", paddingTop: 16 }}>
          <div style={{ fontSize: 36, opacity: 0.75 }}>{COPY.shareCardPm}</div>
          <div style={{ fontFamily: "var(--font-secular), 'Secular One', sans-serif", fontSize: 60, lineHeight: 1.1 }}>
            {pmLabel(bet.pm)}
          </div>
        </div>

        <div style={{ borderTop: "5px dashed #000", paddingTop: 16, flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 36, opacity: 0.75, marginBottom: 10 }}>{COPY.shareCardTop3}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map(({ party, seats }) => (
              <div key={party.key} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <PartyImage partyKey={party.key} size={64} />
                <div
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-secular), 'Secular One', sans-serif",
                    fontSize: 52,
                  }}
                >
                  {party.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-secular), 'Secular One', sans-serif",
                    fontSize: 58,
                    minWidth: 100,
                    textAlign: "center",
                    border: "5px solid #000",
                    borderRadius: 12,
                  }}
                >
                  {seats}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 24, opacity: 0.6, textAlign: "center" }}>
          {COPY.subtitle} · {COPY.shareCardFooter}
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
