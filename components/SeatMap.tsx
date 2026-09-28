import { PARTIES } from "@/lib/parties";
import Hemicycle, { segmentsFrom } from "./Hemicycle";

// כנסת בחצי עיגול + מקרא (מפלגות עם מושבים בלבד), כדי שהזיהוי לא יהיה רק לפי צבע
export default function SeatMap({ seats, title, center, sub }: { seats: Record<string, number>; title: string; center?: string; sub?: string }) {
  const shown = PARTIES.filter((p) => (seats[p.key] ?? 0) > 0);
  return (
    <div className="box p-4">
      <h2 className="mb-2 text-2xl">{title}</h2>
      <Hemicycle segments={segmentsFrom(seats, PARTIES)} center={center} sub={sub} className="mx-auto w-full max-w-[460px]" title={title} />
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        {shown.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
            <span>{p.name}</span>
            <b className="tabular-nums">{seats[p.key]}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
