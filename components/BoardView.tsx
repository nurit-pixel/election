import { COPY } from "@/lib/copy";
import { PARTIES, PM_PARTIES } from "@/lib/parties";
import { largestRemainder } from "@/lib/hemicycle";
import type { BadgeKey } from "@/lib/badges";
import type { BoardData } from "@/lib/board";
import BadgeCards, { BadgeIcons } from "./BadgeCards";
import RevealOverlay from "./RevealOverlay";
import SeatMap from "./SeatMap";
import HBarChart from "./BoardCharts";
import Leaderboard from "./Leaderboard";

// הלוח של קבוצה: דירוג (כשיש תוצאות), תגים, "הכנסת לפי הקבוצה" וגרפים
export default function BoardView({ data }: { data: BoardData }) {
  const { results, players, bets, ranking, badges, playerBadges } = data;
  const mode = results.mode;

  const n = bets.length;
  const avg = PARTIES.map((p) => ({
    label: p.name,
    value: n ? bets.reduce((s, b) => s + (b.seats[p.key] ?? 0), 0) / n : 0,
  })).sort((a, b) => b.value - a.value);

  const pmCounts = new Map<string, number>();
  for (const b of bets) {
    const key = b.pm.startsWith("other:") ? "other" : b.pm;
    pmCounts.set(key, (pmCounts.get(key) ?? 0) + 1);
  }
  const pmData = [
    ...PM_PARTIES.map((p) => ({ label: p.leader || p.name, value: pmCounts.get(p.key) ?? 0 })),
    { label: "מישהו אחר", value: pmCounts.get("other") ?? 0 },
    { label: "אין ממשלה", value: pmCounts.get("none") ?? 0 },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const recruits = players.filter((p) => p.hasBet);
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const badgeNames = Object.fromEntries(
    Object.entries(badges).map(([k, id]) => [k, nameById.get(id) ?? "?"]),
  ) as Partial<Record<BadgeKey, string>>;
  // "הכנסת לפי הקבוצה": ממוצע ההימורים, מעוגל ל-120 מושבים שלמים
  const groupSeats = largestRemainder(
    Object.fromEntries(PARTIES.map((p) => [p.key, n ? bets.reduce((s, b) => s + (b.seats[p.key] ?? 0), 0) / n : 0])),
  );
  const version = `${mode}:${results.updated_at ?? ""}`;

  return (
    <>
      <RevealOverlay mode={mode} />

      {mode !== "none" && (
        <section className="mb-10">
          {mode === "exit_poll" && (
            <p className="chip mb-3 border-accent/60 bg-accent/15 px-3 py-1 font-display text-lg">
              <span className="live-dot" />
              <span className="glow-red">{COPY.exitPollLabel}</span>
            </p>
          )}
          <h1 className="mb-4 text-5xl">{mode === "official" ? "הדירוג הסופי" : "דירוג ביניים"}</h1>
          {ranking.length ? (
            <Leaderboard rows={ranking} version={version} badges={playerBadges} />
          ) : (
            <p className="box p-4">עוד לא חושב ניקוד. רגע.</p>
          )}
          {results.seats && (
            <div className="mt-6">
              <SeatMap seats={results.seats} title={mode === "official" ? "הכנסת ה-26 — תוצאות רשמיות" : "הכנסת לפי המדגמים"} />
            </div>
          )}
        </section>
      )}

      <section className="space-y-6">
        <h1 className={mode === "none" ? "text-5xl" : "text-4xl"}>{COPY.boardBefore}</h1>
        <p className="font-display text-2xl">{COPY.recruits(recruits.length)}</p>
        {recruits.length === 0 ? (
          <p className="box p-4">{COPY.noBetsYet}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {recruits.map((p) => (
                <li key={p.id} className="chip">
                  {p.name}
                  <BadgeIcons keys={playerBadges[p.id]} />
                </li>
              ))}
            </ul>
            <BadgeCards holders={badgeNames} />
            <SeatMap seats={groupSeats} title="הכנסת לפי הקבוצה" center={String(n)} sub="הימורים" />
            <div className="box p-3">
              <h2 className="mb-2 text-2xl">{COPY.avgSeats}</h2>
              <HBarChart data={avg} unit="מנדטים" decimals={1} />
            </div>
            <div className="box p-3">
              <h2 className="mb-2 text-2xl">{COPY.pmDistribution}</h2>
              <HBarChart data={pmData} unit="קולות" />
            </div>
          </>
        )}
      </section>
    </>
  );
}
