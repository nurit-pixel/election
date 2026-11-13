"use client";

import { useState } from "react";

type Point = { day: string; price: number };

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 44 };
const SERIES = "var(--pm-hot-pink)";
const SURFACE = "var(--pm-card)";

/** צעד "עגול" לציר המחירים */
function niceStep(range: number): number {
  const raw = range / 3 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

const dayLabel = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;
const money = (price: number) => `₪${price.toFixed(2)}`;

/** גרף קו של המחיר הזול ביותר לאורך זמן, עם ריחוף שמציג תאריך ומחיר. */
export function PriceChart({ points, target, unit }: { points: Point[]; target: number | null; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((p) => p.price).concat(target != null ? [target] : []);
  const step = niceStep(Math.max(...values) - Math.min(...values) || Math.max(...values) * 0.2);
  const yMin = Math.max(0, Math.floor((Math.min(...values) - step * 0.5) / step) * step);
  const yMax = Math.ceil((Math.max(...values) + step * 0.5) / step) * step;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Number(v.toFixed(2)));

  const times = points.map((p) => new Date(p.day + "T00:00:00Z").getTime());
  const span = Math.max(times[times.length - 1] - times[0], 1);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => (points.length === 1 ? PAD.left + innerW / 2 : PAD.left + ((times[i] - times[0]) / span) * innerW);
  const y = (price: number) => PAD.top + innerH - ((price - yMin) / (yMax - yMin || 1)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  // תוויות תאריך: לכל היותר 6, כולל הראשונה והאחרונה
  const every = Math.max(1, Math.ceil(points.length / 6));
  const labelled = points.map((_, i) => i).filter((i) => i % every === 0 || i === last);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(nearest) - px)) nearest = i;
    });
    setHover(nearest);
  };
  const active = hover ?? last;

  return (
    <figure dir="ltr" className="select-none">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`מחיר לאורך זמן: ${points.length} ימים, מ-${money(points[0].price)} עד ${money(points[last].price)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--pm-border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={12} fill="var(--pm-text-muted)">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {labelled.map((i) => (
          <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={12} fill="var(--pm-text-muted)">
            {dayLabel(points[i].day)}
          </text>
        ))}

        {target != null && (
          <g>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--pm-text-muted)" strokeWidth={1} />
            <text x={WIDTH - PAD.right + 6} y={y(target) + 4} fontSize={11} fill="var(--pm-text-muted)">
              יעד {target}
            </text>
          </g>
        )}

        {hover != null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--pm-text-muted)" strokeWidth={1} />
        )}
        {points.length > 1 && (
          <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {(points.length <= 31 ? points.map((_, i) => i) : [last]).concat(hover != null ? [active] : []).map((i, k) => (
          <circle
            key={`${i}-${k}`}
            cx={x(i)}
            cy={y(points[i].price)}
            r={i === active ? 5 : 4}
            fill={SERIES}
            stroke={SURFACE}
            strokeWidth={2}
          />
        ))}
        {hover == null && (
          <text x={x(last) + 9} y={y(points[last].price) + 4} fontSize={13} fontWeight={600} fill="var(--pm-text)">
            {points[last].price.toFixed(2)}
          </text>
        )}
      </svg>
      <figcaption dir="rtl" className="mt-1 min-h-5 text-center text-sm text-muted">
        {dayLabel(points[active].day)}: <b className="tabular-nums text-ink">{money(points[active].price)}</b>
        {unit}
        {hover == null && " (עדכני)"}
      </figcaption>
    </figure>
  );
}
