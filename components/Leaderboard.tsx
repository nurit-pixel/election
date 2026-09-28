"use client";

import { Fragment, useState } from "react";
import { COPY } from "@/lib/copy";
import type { Bet, Score } from "@/lib/scoring";
import BetDetails from "./BetDetails";

export type LeaderRow = Score & { player_id: string; name: string; place: number; tier: string; bet: Bet };

export default function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
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
          {rows.map((r) => {
            const top = r.place <= 3;
            const isOpen = open === r.player_id;
            return (
              <Fragment key={r.player_id}>
                <tr
                  className={`cursor-pointer border-b border-line transition-colors hover:bg-white/5 ${top ? "bg-gradient-to-l from-gold/15 to-transparent" : ""}`}
                  onClick={() => setOpen(isOpen ? null : r.player_id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(isOpen ? null : r.player_id))}
                  tabIndex={0}
                  aria-expanded={isOpen}
                >
                  <td className={`w-12 px-2 py-2 text-center font-display tabular-nums ${r.place === 1 ? "text-4xl text-gold [text-shadow:0_0_18px_rgb(255_209_102/0.7)]" : top ? "text-3xl glow-red" : "text-xl text-muted"}`}>
                    {r.place}
                  </td>
                  <td className="px-2 py-2">
                    <div className={top ? "font-display text-xl" : "font-semibold"}>{r.name}</div>
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
