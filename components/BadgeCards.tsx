import { BADGES, type BadgeKey } from "@/lib/badges";

// שלושת התגים של המשרד — מי מחזיק בכל אחד
export default function BadgeCards({ holders }: { holders: Partial<Record<BadgeKey, string>> }) {
  const keys = (Object.keys(BADGES) as BadgeKey[]).filter((k) => holders[k]);
  if (!keys.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <div key={k} className="box flex flex-col items-center gap-1 px-2 py-3 text-center" title={BADGES[k].desc}>
          <span className="text-3xl drop-shadow-[0_0_10px_rgb(255_255_255/0.35)]">{BADGES[k].icon}</span>
          <span className="text-xs leading-tight text-muted">{BADGES[k].title}</span>
          <span className="font-display text-lg leading-tight text-fg">{holders[k]}</span>
        </div>
      ))}
    </div>
  );
}

export function BadgeIcons({ keys }: { keys?: BadgeKey[] }) {
  if (!keys?.length) return null;
  return (
    <span className="ms-1 inline-flex gap-0.5 align-middle">
      {keys.map((k) => (
        <span key={k} title={BADGES[k].title} aria-label={BADGES[k].title}>
          {BADGES[k].icon}
        </span>
      ))}
    </span>
  );
}
