"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";

type Tab = "results" | "players" | "groups";

// לשוניות חדר המצב. כולן נשארות טעונות (רק מוסתרות) כדי לא לאבד טיוטת תוצאות.
export default function AdminTabs({ results, players, groups }: { results: React.ReactNode; players: React.ReactNode; groups: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("results");
  const tabBtn = (t: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} className={`btn flex-1 px-2 ${tab === t ? "btn-ink" : ""}`} onClick={() => setTab(t)}>
      {label}
    </button>
  );
  return (
    <>
      <div className="mb-6 flex gap-2" role="tablist">
        {tabBtn("results", COPY.admin.tabResults)}
        {tabBtn("players", COPY.admin.tabPlayers)}
        {tabBtn("groups", "קבוצות")}
      </div>
      <div hidden={tab !== "results"}>{results}</div>
      <div hidden={tab !== "players"}>{players}</div>
      <div hidden={tab !== "groups"}>{groups}</div>
    </>
  );
}
