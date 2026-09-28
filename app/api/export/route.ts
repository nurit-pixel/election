import { isAdmin } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { PARTIES } from "@/lib/parties";
import { BONUS_KEYS } from "@/lib/copy";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return new Response("unauthorized", { status: 401 });
  const { players, bets, ranking } = await loadBoard();
  const betBy = new Map(bets.map((b) => [b.player_id, b]));
  const scoreBy = new Map(ranking.map((r) => [r.player_id, r]));

  const header = [
    "place", "name", "tier", "total", "seat_pts", "pm_pts", "bloc_pts", "bonus_pts", "exact_hits",
    "pm", "bloc", ...BONUS_KEYS, ...PARTIES.map((p) => p.key), "submitted_at", "updated_at",
  ];
  const lines = [header.join(",")];
  const ordered = [...players].sort((a, b) => (scoreBy.get(a.id)?.place ?? 1e9) - (scoreBy.get(b.id)?.place ?? 1e9));
  for (const p of ordered) {
    const b = betBy.get(p.id);
    const s = scoreBy.get(p.id);
    lines.push(
      [
        s?.place, p.name, s?.tier, s?.total, s?.seat_pts, s?.pm_pts, s?.bloc_pts, s?.bonus_pts, s?.exact_hits,
        b?.pm, b?.bloc, ...BONUS_KEYS.map((k) => b?.bonus[k]), ...PARTIES.map((x) => b?.seats[x.key]),
        b?.submitted_at, b?.updated_at,
      ].map(esc).join(","),
    );
  }
  // BOM כדי שאקסל יפתח עברית נכון
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="koach43-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
