import { HEMI_H, HEMI_W, seatColors, seatPositions, type Segment } from "@/lib/hemicycle";

const SEATS = seatPositions();
const EMPTY = "rgba(125,160,255,0.16)";

type Props = {
  segments: Segment[];
  /** טקסט גדול במרכז (למשל 118) */
  center?: string;
  /** טקסט קטן מתחת למרכז */
  sub?: string;
  centerColor?: string;
  /** מושבים עודפים מעל 120 — מוצגים כתווית אדומה */
  overflow?: number;
  className?: string;
  title?: string;
};

// "כנסת" בחצי עיגול: 120 מושבים, כל מפלגה בצבע שלה, מימין לשמאל לפי סדר הרשימה.
export default function Hemicycle({ segments, center, sub, centerColor = "#eef2ff", overflow = 0, className = "", title }: Props) {
  const colors = seatColors(segments);
  return (
    <svg viewBox={`0 0 ${HEMI_W} ${HEMI_H}`} className={className} role="img" aria-label={title ?? "חלוקת 120 המושבים"}>
      {SEATS.map((s, i) => {
        const c = colors[i];
        return (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={c ?? EMPTY}
            stroke={c ? "rgba(255,255,255,0.35)" : "none"}
            strokeWidth={0.35}
            style={{
              transition: "fill 0.25s ease",
              filter: c ? `drop-shadow(0 0 1.2px ${c})` : undefined,
            }}
          />
        );
      })}
      {center && (
        <text
          x={HEMI_W / 2}
          y={HEMI_H - (sub ? 16 : 8)}
          textAnchor="middle"
          fill={centerColor}
          style={{ fontFamily: "var(--font-secular), 'Secular One', sans-serif", fontSize: 24, filter: `drop-shadow(0 0 4px ${centerColor})` }}
        >
          {center}
        </text>
      )}
      {sub && (
        <text x={HEMI_W / 2} y={HEMI_H - 3} textAnchor="middle" fill="#93a0c8" style={{ fontSize: 9, fontFamily: "var(--font-assistant), sans-serif" }}>
          {sub}
        </text>
      )}
      {overflow > 0 && (
        <text x={HEMI_W / 2} y={12} textAnchor="middle" fill="#ff2d55" style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-assistant), sans-serif" }}>
          +{overflow} מושבים שלא נכנסים
        </text>
      )}
    </svg>
  );
}

/** עוזר: מהימור/תוצאה (מפתח→מושבים) לרשימת מקטעים לפי סדר המפלגות */
export function segmentsFrom(
  seats: Record<string, number>,
  parties: { key: string; color: string }[],
): Segment[] {
  return parties.map((p) => ({ key: p.key, color: p.color, count: Math.max(0, seats[p.key] ?? 0) }));
}
