"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";
import type { AdminPlayer } from "@/lib/players";
import type { HistoryEntry } from "@/lib/historyDiff";
import BetHistory from "./BetHistory";

const A = COPY.admin;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function AdminPlayers({ initial }: { initial: AdminPlayer[] }) {
  const router = useRouter();
  const [players, setPlayers] = useState(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<{ available: boolean; entries: HistoryEntry[] } | null>(null);

  async function toggleHistory(p: AdminPlayer) {
    if (historyFor === p.id) return setHistoryFor(null);
    setHistoryFor(p.id);
    setHistory(null);
    const res = await fetch(`/api/players/history?id=${encodeURIComponent(p.id)}`);
    setHistory(res.ok ? await res.json() : { available: false, entries: [] });
  }

  const shown = useMemo(() => {
    const t = q.trim();
    return t ? players.filter((p) => p.name.includes(t)) : players;
  }, [players, q]);
  const submittedCount = players.filter((p) => p.hasBet).length;

  async function call(method: "PATCH" | "DELETE", body: object) {
    const res = await fetch("/api/players", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function saveName(p: AdminPlayer) {
    const name = draftName.trim();
    if (!name || name === p.name) return setEditing(null);
    setBusy(p.id);
    setMsg(null);
    const r = await call("PATCH", { id: p.id, name });
    setBusy(null);
    if (r.status === 409) return setMsg(A.nameTaken);
    if (!r.ok) return setMsg(COPY.genericError);
    setPlayers((all) => all.map((x) => (x.id === p.id ? { ...x, name: r.data.name } : x)));
    setEditing(null);
    router.refresh();
  }

  async function reset(p: AdminPlayer) {
    if (!confirm(A.confirmReset(p.name))) return;
    setBusy(p.id);
    const r = await call("DELETE", { id: p.id, betOnly: true });
    setBusy(null);
    if (!r.ok) return setMsg(COPY.genericError);
    setPlayers((all) => all.map((x) => (x.id === p.id ? { ...x, hasBet: false, updated_at: null, total: null } : x)));
    router.refresh();
  }

  async function remove(p: AdminPlayer) {
    if (!confirm(A.confirmRemove(p.name))) return;
    setBusy(p.id);
    const r = await call("DELETE", { id: p.id });
    setBusy(null);
    if (!r.ok) return setMsg(COPY.genericError);
    setPlayers((all) => all.filter((x) => x.id !== p.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="font-display text-2xl">{A.playersTitle(players.length, submittedCount)}</p>
      <input className="input" placeholder={A.search} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      {msg && (
        <p className="font-semibold text-accent" role="alert">
          {msg}
        </p>
      )}
      {players.length === 0 && <p className="box p-4">{A.noPlayers}</p>}
      <ul className="space-y-2">
        {shown.map((p) => (
          <li key={p.id} className="box p-3" style={{ opacity: busy === p.id ? 0.5 : 1 }}>
            {editing === p.id ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName(p);
                }}
              >
                <input className="input flex-1" value={draftName} maxLength={30} autoFocus onChange={(e) => setDraftName(e.target.value)} />
                <button className="btn btn-ink px-3 text-base" disabled={busy === p.id}>
                  {A.saveName}
                </button>
                <button type="button" className="btn px-3 text-base" onClick={() => setEditing(null)}>
                  {A.cancel}
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-display text-xl">{p.name}</span>
                  {p.total !== null && <span className="font-display text-xl tabular-nums glow-cyan">{p.total}</span>}
                  <span className={`chip px-2 py-0 text-xs ${p.hasBet ? "border-ok/50 text-ok" : "text-muted"}`}>
                    {p.hasBet ? A.submitted : A.notSubmitted}
                  </span>
                </div>
                {p.updated_at && <div className="text-xs text-muted">עודכן {fmt(p.updated_at)}</div>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn min-h-10 flex-1 px-2 text-sm"
                    disabled={!!busy}
                    onClick={() => {
                      setEditing(p.id);
                      setDraftName(p.name);
                      setMsg(null);
                    }}
                  >
                    ✏️ {A.rename}
                  </button>
                  <button
                    type="button"
                    className={`btn min-h-10 flex-1 px-2 text-sm ${historyFor === p.id ? "btn-ink" : ""}`}
                    aria-expanded={historyFor === p.id}
                    onClick={() => toggleHistory(p)}
                  >
                    🕘 {A.history}
                  </button>
                  {p.hasBet && (
                    <button type="button" className="btn min-h-10 flex-1 px-2 text-sm" disabled={!!busy} onClick={() => reset(p)}>
                      ↺ {A.resetBet}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn min-h-10 flex-1 border-accent/50 px-2 text-sm text-accent"
                    disabled={!!busy}
                    onClick={() => remove(p)}
                  >
                    🗑 {A.remove}
                  </button>
                </div>
                {historyFor === p.id && (
                  <div className="mt-3 border-t border-line pt-3">
                    {history ? <BetHistory entries={history.entries} available={history.available} /> : <p className="text-sm text-muted">טוען…</p>}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
