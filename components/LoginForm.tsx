"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";

// כניסה עם שם משתמש + קוד אישי. שם שלא קיים → מציעים ליצור משתמש חדש.
export default function LoginForm({ next = "/me" }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offerCreate, setOfferCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(create: boolean) {
    if (!name.trim()) return setError(COPY.joinNameMissing);
    if (!/^\d{4}$/.test(pin)) return setError(COPY.pinFormat);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin, create }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setOfferCreate(true);
        return setError(COPY.notFound(name.trim()));
      }
      if (!res.ok) {
        setOfferCreate(false);
        return setError(
          data.error === "bad_pin"
            ? COPY.badPin(data.left)
            : data.error === "locked"
              ? COPY.locked15
              : data.error === "weak_pin"
                ? COPY.weakPin
                : data.error === "name_taken"
                  ? COPY.nameTaken
                  : data.error === "bad_pin_format"
                    ? COPY.pinFormat
                    : COPY.genericError,
        );
      }
      // משתמש חדש בלי הימור → ישר לטופס; אחרת ליעד המבוקש
      router.push(data.status === "new" && next === "/me" ? "/bet" : next);
      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
      className="box space-y-4 p-4"
      noValidate
    >
      <label className="block">
        <span className="mb-1 block font-semibold">{COPY.joinNameLabel}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setOfferCreate(false);
          }}
          maxLength={30}
          autoComplete="username"
          enterKeyHint="next"
          autoFocus
        />
        <span className="mt-1 block text-xs text-muted">{COPY.joinNameHint}</span>
      </label>
      <label className="block">
        <span className="mb-1 block font-semibold">{COPY.pinLabel}</span>
        <input
          className="input text-center font-display text-3xl tracking-[0.6em]"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            setOfferCreate(false);
          }}
          inputMode="numeric"
          autoComplete="current-password"
          type="password"
          dir="ltr"
          maxLength={4}
          enterKeyHint="go"
          aria-describedby="pin-hint"
        />
        <span id="pin-hint" className="mt-1 block text-xs text-muted">
          {COPY.pinHintNew}
        </span>
      </label>
      {error && (
        <p className="font-semibold text-accent" role="alert">
          {error}
        </p>
      )}
      {offerCreate ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send(true)}>
            {COPY.createButton}
          </button>
          <button type="button" className="btn" onClick={() => (setOfferCreate(false), setError(null))}>
            תיקון השם
          </button>
        </div>
      ) : (
        <button type="submit" className="btn btn-primary w-full text-2xl" disabled={busy}>
          {busy ? COPY.saving : COPY.joinButton}
        </button>
      )}
      <p className="text-center text-sm text-muted">{COPY.joinHint}</p>
    </form>
  );
}
