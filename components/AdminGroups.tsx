"use client";

import Link from "next/link";
import { useState } from "react";
import type { GroupWithCount } from "@/lib/groups";

export default function AdminGroups({ initial }: { initial: GroupWithCount[] }) {
  const [groups, setGroups] = useState(initial);
  if (!groups.length) return <p className="box p-4 text-muted">עוד אין קבוצות.</p>;
  return (
    <ul className="space-y-2">
      <li className="font-display text-2xl">{groups.length} קבוצות</li>
      {groups.map((g) => (
        <li key={g.id} className="box flex items-center gap-2 p-3" style={{ borderColor: `${g.color}55` }}>
          <span className="text-2xl">{g.emoji}</span>
          <Link href={`/g/${g.slug}`} className="min-w-0 flex-1 truncate font-semibold text-fg no-underline">
            {g.name}
            <span className="block text-xs font-normal text-muted">
              {g.members} משתתפים · {g.is_public ? "פתוחה" : "פרטית"} · <span dir="ltr">{g.slug}</span>
            </span>
          </Link>
          <button
            type="button"
            className="btn min-h-10 border-accent/50 px-3 text-sm text-accent"
            onClick={async () => {
              if (!confirm(`למחוק את "${g.name}"?`)) return;
              const res = await fetch("/api/admin/groups", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: g.id }),
              });
              if (res.ok) setGroups((x) => x.filter((y) => y.id !== g.id));
            }}
          >
            מחיקה
          </button>
        </li>
      ))}
    </ul>
  );
}
