"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";

// שתי לשוניות בחדר המצב. שתיהן נשארות טעונות (רק מוסתרות) כדי לא לאבד טיוטת תוצאות.
export default function AdminTabs({ results, players }: { results: React.ReactNode; players: React.ReactNode }) {
  const [tab, setTab] = useState<"results" | "players">("results");
  const tabBtn = (t: typeof tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      className={`btn flex-1 ${tab === t ? "btn-ink" : ""}`}
      onClick={() => setTab(t)}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="mb-6 flex gap-2" role="tablist">
        {tabBtn("results", COPY.admin.tabResults)}
        {tabBtn("players", COPY.admin.tabPlayers)}
      </div>
      <div hidden={tab !== "results"}>{results}</div>
      <div hidden={tab !== "players"}>{players}</div>
    </>
  );
}
