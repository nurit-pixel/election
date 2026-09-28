import type { Party } from "@/lib/parties";
import PartyImage from "./PartyImage";

export default function PartyCard({ party, children }: { party: Party; children?: React.ReactNode }) {
  return (
    <div
      className="box overflow-hidden"
      style={{
        borderInlineStartWidth: 4,
        borderInlineStartColor: party.color,
        backgroundImage: `radial-gradient(260px 120px at 100% 0%, ${party.color}2e, transparent 70%), linear-gradient(180deg, rgb(23 33 74 / 0.85), rgb(14 21 49 / 0.9))`,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <PartyImage partyKey={party.key} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-2xl">{party.name}</h3>
            <span
              className="rounded-md px-1.5 font-display text-sm leading-6 text-white shadow-[0_0_10px_rgb(0_0_0/0.4)]"
              style={{ background: party.color }}
              title="אות הפתק"
            >
              {party.letters}
            </span>
          </div>
          {party.leader && <p className="text-base text-fg/85">{party.leader}</p>}
          <p className="text-sm leading-snug text-muted">{party.trivia}</p>
        </div>
      </div>
      {children && <div className="border-t border-line px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}
