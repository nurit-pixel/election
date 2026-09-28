"use client";

import { useEffect, useRef, useState } from "react";
import { BADGES, type BadgeKey } from "@/lib/badges";

const TIER_ICON: Record<string, string> = {
  "פעיל שטח": "📣",
  "יועץ אסטרטגי": "🧠",
  "מנהל קמפיין": "📋",
  "סוקר-על": "📊",
  "הנביא מכוח 43": "🔮",
};

type Props = {
  name: string;
  tier: string | null; // null = לפני תוצאות
  total?: number;
  place?: number;
  pm: string;
  topParty?: { name: string; color: string; seats: number; letters: string };
  bonusYes: number;
  badges: BadgeKey[];
};

// קלף שחקן הולוגרפי: מסתובב ומנצנץ עם תנועת האצבע/העכבר או הטיית הטלפון
export default function PlayerCard({ name, tier, total, place, pm, topParty, bonusYes, badges }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const setTilt = (px: number, py: number) => {
    // px, py בטווח 0..1
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `${(0.5 - py) * 18}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 22}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const px = Math.max(0, Math.min(1, (e.gamma + 30) / 60));
      const py = Math.max(0, Math.min(1, (e.beta - 20) / 60));
      setTilt(px, py);
    };
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DOE?.requestPermission) setNeedsPermission(true); // iOS: צריך אישור מהמשתמש
    else window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  async function enableMotion() {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    try {
      if ((await DOE?.requestPermission?.()) === "granted") {
        window.addEventListener("deviceorientation", (e) => {
          if (e.beta == null || e.gamma == null) return;
          setTilt(Math.max(0, Math.min(1, (e.gamma + 30) / 60)), Math.max(0, Math.min(1, (e.beta - 20) / 60)));
        });
        setNeedsPermission(false);
      }
    } catch {}
  }

  const accent = topParty?.color ?? "#22d3ee";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="[perspective:900px]">
        <div
          ref={ref}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
          }}
          onPointerLeave={() => setTilt(0.5, 0.5)}
          className="relative h-[400px] w-[286px] overflow-hidden rounded-[22px] p-[2px] transition-transform duration-150 ease-out"
          style={{
            transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
            background: `linear-gradient(135deg, ${accent}, #22d3ee 40%, #ff2d55 70%, #ffd166)`,
            boxShadow: `0 20px 60px rgb(0 0 0 / 0.6), 0 0 40px ${accent}55`,
          }}
        >
          <div
            className="relative flex h-full flex-col rounded-[20px] p-5"
            style={{ background: `radial-gradient(240px 200px at 50% 0%, ${accent}40, transparent 70%), linear-gradient(180deg, #111a3d, #060a18)` }}
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-display tracking-widest">כוח 43</span>
              <span className="chip border-accent/50 px-2 py-0 text-[11px]">
                <span className="live-dot h-2 w-2" /> 2026
              </span>
            </div>

            <div className="mt-4 flex flex-col items-center text-center">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 text-5xl"
                style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)`, boxShadow: `0 0 30px ${accent}66` }}
              >
                {tier ? TIER_ICON[tier] ?? "⭐" : "🗳️"}
              </div>
              <div className="mt-3 max-w-full truncate font-display text-4xl leading-tight">{name}</div>
              <div className="mt-1 font-display text-lg glow-cyan">{tier ?? "מגויס/ת למטה"}</div>
              {tier === null && <div className="text-xs text-muted">הדרגה תיחשף בליל הבחירות</div>}
              {tier !== null && total !== undefined && (
                <div className="text-sm text-muted">
                  {total} נקודות{place ? ` · מקום ${place}` : ""}
                </div>
              )}
            </div>

            <dl className="mt-auto grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 px-1 py-2">
                <dt className="text-[10px] text-muted">רה&quot;מ</dt>
                <dd className="truncate font-display text-sm">{pm}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-1 py-2">
                <dt className="text-[10px] text-muted">הגדולה</dt>
                <dd className="truncate font-display text-sm">{topParty ? `${topParty.letters} · ${topParty.seats}` : "—"}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-1 py-2">
                <dt className="text-[10px] text-muted">בונוס &quot;כן&quot;</dt>
                <dd className="font-display text-sm">{bonusYes}/5</dd>
              </div>
            </dl>

            {badges.length > 0 && (
              <div className="mt-2 flex justify-center gap-2 text-xs">
                {badges.map((b) => (
                  <span key={b} className="chip px-2 py-0">
                    {BADGES[b].icon} {BADGES[b].title}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* שכבת הולוגרמה */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[22px] opacity-35 mix-blend-color-dodge"
            style={{
              background:
                "linear-gradient(115deg, transparent 25%, rgb(255 0 128 / 0.35) 40%, rgb(0 255 255 / 0.35) 50%, rgb(255 255 0 / 0.3) 60%, transparent 75%)",
              backgroundSize: "250% 250%",
              backgroundPosition: "var(--gx, 50%) var(--gy, 50%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[22px]"
            style={{ background: "radial-gradient(circle at var(--gx, 50%) var(--gy, 30%), rgb(255 255 255 / 0.22), transparent 45%)" }}
          />
        </div>
      </div>
      {needsPermission && (
        <button type="button" className="text-sm text-cyan underline underline-offset-4" onClick={enableMotion}>
          ✨ הפעלת הולוגרמה בהטיית הטלפון
        </button>
      )}
    </div>
  );
}
