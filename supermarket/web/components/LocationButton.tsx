"use client";

import { useState, useTransition } from "react";
import { addCurrentLocation } from "@/app/settings/actions";

const ERRORS: Record<number, string> = {
  1: "אין הרשאה למיקום. מאשרים גישה למיקום בהגדרות הדפדפן ומנסים שוב.",
  2: "לא הצלחנו לקבל מיקום. בודקים שהמיקום (GPS) פעיל במכשיר.",
  3: "קבלת המיקום לקחה יותר מדי זמן. מנסים שוב.",
};

/** הוספת כתובת לפי המיקום הנוכחי של המכשיר. המיקום נלקח רק בלחיצה, ולא נשמר מעבר לכתובת. */
export function LocationButton({ defaultRadius }: { defaultRadius: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError("הדפדפן הזה לא תומך בשירותי מיקום.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        const label = (document.querySelector<HTMLInputElement>("#new-address-label")?.value ?? "").trim();
        const radius = Number(document.querySelector<HTMLInputElement>("#new-radius")?.value) || defaultRadius;
        startSaving(() => addCurrentLocation(position.coords.latitude, position.coords.longitude, label, radius));
      },
      (failure) => {
        setBusy(false);
        setError(ERRORS[failure.code] ?? ERRORS[2]);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={locate}
        disabled={busy || saving}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] border-2 border-[var(--pm-button-edge)] bg-card px-4 text-sm font-bold disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {busy ? "מאתרים את המיקום…" : saving ? "שומרים…" : "שימוש במיקום הנוכחי"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-missing">
          {error}
        </p>
      )}
    </div>
  );
}
