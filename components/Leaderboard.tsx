"use client";

import { Fragment, useEffect, useState } from "react";
import type { BadgeKey } from "@/lib/badges";
import { BadgeIcons } from "./BadgeCards";
import { COPY } from "@/lib/copy";
import type { Bet, Score } from "@/lib/scoring";
import BetDetails from "./BetDetails";

export type LeaderRow = Score & { player_id: string; name: string; place: number; tier: string; bet: Bet };

const RANKS_KEY = "k43-ranks";
type Saved = { version: string; places: Record<string, number>; prev: Record<string, number> };

/**
 * שינוי מקום מאז העדכון הקודם של התוצאות (לפי version = מצב + זמן עדכון).
 * נשמר בדפדפן: כשמגיעה גרסה חדשה, המקומות הקודמים הופכים ל-prev והחצים נשארים עד העדכון הבא.
 */
function useRankDeltas(rows: LeaderRow[], version: string): Record<string, number> {
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  useEffect(() => {
    const places = Object.fromEntries(rows.map((r) => [r.player_id, r.place]));
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(RANKS_KEY) || "null");
    } catch {}
    let prev: Record<string, number> = {};
    if (saved && saved.version === version) prev = saved.prev;
    else if (saved) prev = saved.places;
    try {
      localStorage.setItem(RANKS_KEY, JSON.stringify({ version, places, prev }));
    } catch {}
    setDeltas(Object.fromEntries(rows.filter((r) => prev[r.player_id]).map((r) => [r.player_id, prev[r.player_id] - r.place])));
  }, [rows, version]);
  return deltas;
}

function Delta({ d }: { d?: number }) {
  if (!d) return null;
  const up = d > 0;
  return (
    <span className={`font-body text-xs font-bold ${up ? "text-ok" : "text-accent"}`} aria-label={up ? `עלה ${d}` : `ירד ${-d}`}>
      {up ? "▲" : "▼"}
      {Math.abs(d)}
    </span>
  );
}

type Props = { rows: LeaderRow[]; version?: string; badges?: Record<string, BadgeKey[]> };

export default function Leaderboard({ rows, version = "", badges = {} }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const deltas = useRankDeltas(rows, version);
  return (
    <div className="box overflow-hidden">
      <table className="w-full border-collapse text-right">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-muted">
            <th className="px-2 py-2 text-sm font-semibold">{COPY.colPlace}</th>
            <th className="px-2 py-2 text-sm font-semibold">{COPY.colName}</th>
            <th className="px-2 py-2 text-sm font-semibold">{COPY.colPoints}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const top = r.place <= 3;
            const isOpen = open === r.player_id;
            return (
              <Fragment key={r.player_id}>
                <tr
                  className={`cursor-pointer border-b border-line transition-colors hover:bg-white/5 ${top ? "bg-gradient-to-l from-gold/15 to-transparent" : ""}`}
                  style={{
                    animation: `slide-in-row 0.45s ${Math.min(i, 12) * 0.06}s both${deltas[r.player_id] ? ", flash-row 1.6s 0.5s" : ""}`,
                  }}
                  onClick={() => setOpen(isOpen ? null : r.player_id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(isOpen ? null : r.player_id))}
                  tabIndex={0}
                  aria-expanded={isOpen}
                >
                  <td className={`w-12 px-2 py-2 text-center font-display tabular-nums ${r.place === 1 ? "text-4xl text-gold [text-shadow:0_0_18px_rgb(255_209_102/0.7)]" : top ? "text-3xl glow-red" : "text-xl text-muted"}`}>
                    {r.place}
                    <div className="leading-none">
                      <Delta d={deltas[r.player_id]} />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className={top ? "font-display text-xl" : "font-semibold"}>
                      {r.name}
                      <BadgeIcons keys={badges[r.player_id]} />
                    </div>
                    <div className="text-sm text-cyan">{r.tier}</div>
                    <div className="text-xs text-muted">{COPY.breakdown(r.seat_pts, r.pm_pts, r.bloc_pts, r.bonus_pts)}</div>
                  </td>
                  <td className={`w-16 px-2 py-2 text-center font-display tabular-nums ${top ? "text-3xl glow-cyan" : "text-2xl"}`}>
                    {r.total}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-line bg-bg/60">
                    <td colSpan={3} className="px-3 py-3">
                      <BetDetails bet={r.bet} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
