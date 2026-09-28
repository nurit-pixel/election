"use client";

import { COPY } from "@/lib/copy";

type Props = { text: string; value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean };

export default function BonusToggle({ text, value, onChange, disabled }: Props) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      className={`btn flex-1 ${value === v ? "btn-ink" : ""}`}
      aria-pressed={value === v}
      onClick={() => onChange(v)}
      disabled={disabled}
    >
      {label}
    </button>
  );
  return (
    <div className="box p-3">
      <p className="mb-2 font-semibold leading-snug">{text}</p>
      <div className="flex gap-3">
        {opt(true, COPY.yes)}
        {opt(false, COPY.no)}
      </div>
    </div>
  );
}
