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
      className="box relative flex flex-col items-center gap-1 p-3 text-center"
      style={{
        borderColor: selected ? (color ?? "#000") : "#000",
        boxShadow: selected ? `0 0 0 3px ${color ?? "var(--color-accent)"}` : undefined,
        background: selected ? "#fff" : undefined,
      }}
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
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-black font-display text-3xl">
            ?
          </span>
        )}
        <span className="font-display text-lg leading-tight">{title}</span>
        {subtitle && <span className="text-sm leading-tight opacity-75">{subtitle}</span>}
      </button>
      {selected && (
        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-accent text-white">
          ✓
        </span>
      )}
      {children}
    </div>
  );
}
