type Row = { label: string; value: number };

// גרף עמודות אופקי, סדרה אחת בצבע ניטרלי (צבעי מפלגות מופיעים רק על הכרטיסים שלהן).
// HTML פשוט במקום ספריית גרפים — מתנהג נכון ב-RTL ובכל רוחב.
export default function HBarChart({ data, unit, decimals = 0 }: { data: Row[]; unit: string; decimals?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2 text-base"
          title={`${d.label}: ${d.value.toFixed(decimals)} ${unit}`}
        >
          <span className="truncate leading-tight">{d.label}</span>
          <span className="h-5">
            <span
              className="block h-full rounded-l-[4px] bg-ink"
              style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 2 : 0 }}
            />
          </span>
          <span className="text-left font-bold tabular-nums">{d.value.toFixed(decimals)}</span>
        </li>
      ))}
    </ul>
  );
}
