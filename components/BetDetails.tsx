import { BONUS, COPY } from "@/lib/copy";
import { PARTIES } from "@/lib/parties";
import type { Bet } from "@/lib/scoring";
import { pmLabel } from "@/lib/betLabels";

// ההימור המלא של שחקן (נפתח בלחיצה על שורה בלוח)
export default function BetDetails({ bet }: { bet: Bet }) {
  const seats = PARTIES.filter((p) => (bet.seats[p.key] ?? 0) > 0).sort((a, b) => bet.seats[b.key] - bet.seats[a.key]);
  return (
    <div className="space-y-2 text-base">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {seats.map((p) => (
          <span key={p.key}>
            {p.name} <b className="tabular-nums">{bet.seats[p.key]}</b>
          </span>
        ))}
      </div>
      <div>
        רה&quot;מ: <b>{pmLabel(bet.pm)}</b> · גוש: <b>{bet.bloc === "coalition" ? COPY.blocCoalition : COPY.blocOpposition}</b>
      </div>
      <ul className="space-y-0.5">
        {BONUS.map((b) => (
          <li key={b.key}>
            {b.text} <b>{bet.bonus[b.key] ? COPY.yes : COPY.no}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
