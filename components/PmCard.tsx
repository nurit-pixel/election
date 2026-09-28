"use client";

import PartyImage from "./PartyImage";

type Props = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  partyKey?: string;
  color?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

export default function PmCard({ selected, onSelect, title, subtitle, partyKey, color, disabled, children }: Props) {
  return (
    <div
      className="box relative flex flex-col items-center gap-1 p-3 text-center transition-shadow"
      style={
        selected
          ? {
              borderColor: "var(--color-cyan)",
              boxShadow: `0 0 0 1px var(--color-cyan), 0 0 26px rgb(34 211 238 / 0.35)`,
              backgroundImage: `radial-gradient(160px 100px at 50% 0%, ${color ?? "#22d3ee"}40, transparent 70%), linear-gradient(180deg, rgb(23 33 74 / 0.95), rgb(14 21 49 / 0.95))`,
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className="flex min-h-12 w-full flex-col items-center gap-1 disabled:cursor-not-allowed"
      >
        {partyKey ? (
          <PartyImage partyKey={partyKey} size={72} />
        ) : (
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-line bg-surface-2 font-display text-3xl text-muted">
            ?
          </span>
        )}
        <span className="font-display text-lg leading-tight">{title}</span>
        {subtitle && <span className="text-sm leading-tight text-muted">{subtitle}</span>}
      </button>
      {selected && (
        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan font-bold text-bg shadow-[0_0_12px_rgb(34_211_238/0.7)]">
          ✓
        </span>
      )}
      {children}
    </div>
  );
}
