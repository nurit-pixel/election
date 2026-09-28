import type { Party } from "@/lib/parties";
import PartyImage from "./PartyImage";

export default function PartyCard({ party, children }: { party: Party; children?: React.ReactNode }) {
  return (
    <div className="box overflow-hidden" style={{ borderInlineStartWidth: 10, borderInlineStartColor: party.color }}>
      <div className="flex items-center gap-3 p-3">
        <PartyImage partyKey={party.key} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-2xl">{party.name}</h3>
            <span
              className="rounded-[4px] border-2 border-black px-1.5 font-display text-sm leading-6 text-white"
              style={{ background: party.color }}
              title="אות הפתק"
            >
              {party.letters}
            </span>
          </div>
          {party.leader && <p className="text-base opacity-80">{party.leader}</p>}
          <p className="text-sm leading-snug opacity-70">{party.trivia}</p>
        </div>
      </div>
      {children && <div className="border-t-2 border-dashed border-black/30 px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}
