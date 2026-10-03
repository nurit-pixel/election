import Link from "next/link";
import type { GroupWithCount } from "@/lib/groups";

export default function GroupCard({ group, href, badge }: { group: GroupWithCount; href?: string; badge?: string }) {
  return (
    <Link
      href={href ?? `/g/${group.slug}`}
      className="box flex items-center gap-3 p-3 no-underline transition-transform active:scale-[0.98]"
      style={{ borderColor: `${group.color}66`, boxShadow: `0 0 24px ${group.color}22` }}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ background: `${group.color}22`, boxShadow: `inset 0 0 0 1px ${group.color}55` }}
      >
        {group.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-xl text-fg">{group.name}</span>
        <span className="text-sm text-muted">
          {group.members} משתתפים{group.is_public ? " · פתוחה" : ""}
        </span>
      </span>
      {badge && <span className="chip px-2 py-0 text-xs" style={{ color: group.color }}>{badge}</span>}
      <span className="text-muted" aria-hidden>‹</span>
    </Link>
  );
}
