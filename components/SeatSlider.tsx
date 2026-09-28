"use client";

import { MAX_SEATS_PER_PARTY } from "@/lib/parties";

type Props = {
  value: number;
  onChange: (v: number) => void;
  color: string;
  label: string;
  max?: number;
  disabled?: boolean;
};

export default function SeatSlider({ value, onChange, color, label, max = MAX_SEATS_PER_PARTY, disabled }: Props) {
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  const fill = `${(value / max) * 100}%`;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn h-12 w-12 shrink-0 px-0 text-2xl"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`הוספת מנדט ל${label}`}
      >
        +
      </button>
      <input
        type="range"
        className="seat min-w-0 flex-1"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={`מנדטים ל${label}`}
        style={{ ["--party" as string]: color, ["--fill" as string]: fill }}
      />
      <button
        type="button"
        className="btn h-12 w-12 shrink-0 px-0 text-2xl"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={`הורדת מנדט מ${label}`}
      >
        −
      </button>
      <output className="w-14 shrink-0 text-center font-display text-4xl tabular-nums" aria-live="polite">
        {value}
      </output>
    </div>
  );
}
