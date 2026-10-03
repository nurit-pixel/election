"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_COLORS, GROUP_EMOJIS } from "@/lib/groupScore";

type Values = { name: string; emoji: string; color: string; is_public: boolean };

// טופס יצירה/עריכה של קבוצה: שם, אימוג'י, צבע, פרטית/פתוחה
export default function GroupForm({ slug, initial }: { slug?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial ?? { name: "", emoji: GROUP_EMOJIS[0], color: GROUP_COLORS[0], is_public: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<Values>) => setV((x) => ({ ...x, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return setMsg("צריך שם לקבוצה.");
    setBusy(true);
    setMsg(null);
    const res = await fetch(slug ? `/api/groups/${slug}` : "/api/groups", {
      method: slug ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.status === 401) return router.push("/");
    if (!res.ok) return setMsg("משהו השתבש. נסו שוב.");
    const { group } = await res.json();
    if (slug) {
      setMsg("נשמר ✓");
      router.refresh();
    } else router.push(`/g/${group.slug}?created=1`);
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {/* תצוגה מקדימה */}
      <div className="box flex items-center gap-3 p-3" style={{ borderColor: `${v.color}66`, boxShadow: `0 0 28px ${v.color}33` }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `${v.color}22` }}>
          {v.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-2xl">{v.name || "שם הקבוצה"}</span>
      </div>

      <label className="block">
        <span className="mb-1 block font-semibold">שם הקבוצה</span>
        <input className="input" value={v.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="למשל: המשפחה המורחבת" />
      </label>

      <fieldset>
        <legend className="mb-2 font-semibold">אימוג&apos;י</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {GROUP_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={v.emoji === e}
              onClick={() => set({ emoji: e })}
              className={`flex aspect-square items-center justify-center rounded-xl border text-2xl ${v.emoji === e ? "border-cyan bg-cyan/15" : "border-line bg-surface-2/60"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">צבע</legend>
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={v.color === c}
              onClick={() => set({ color: c })}
              className="h-11 w-11 rounded-full border-2"
              style={{ background: c, borderColor: v.color === c ? "#fff" : "transparent", boxShadow: v.color === c ? `0 0 16px ${c}` : undefined }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">מי יכול/ה להצטרף?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`btn h-auto flex-col py-2 text-base ${!v.is_public ? "btn-ink" : ""}`} onClick={() => set({ is_public: false })}>
            🔒 פרטית
            <span className="font-body text-xs text-muted">רק מי שקיבל/ה קישור</span>
          </button>
          <button type="button" className={`btn h-auto flex-col py-2 text-base ${v.is_public ? "btn-ink" : ""}`} onClick={() => set({ is_public: true })}>
            🌍 פתוחה
            <span className="font-body text-xs text-muted">מופיעה ברשימה לכולם</span>
          </button>
        </div>
      </fieldset>

      {msg && <p className={msg.includes("✓") ? "text-ok" : "text-accent"} role="status">{msg}</p>}
      <button className="btn btn-primary w-full text-xl" disabled={busy}>
        {busy ? "שומר…" : slug ? "שמירה" : "יצירת הקבוצה"}
      </button>
    </form>
  );
}
