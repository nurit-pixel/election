"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";

export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(COPY.joinNameMissing);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(COPY.genericError);
      router.push("/bet");
      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="box space-y-4 p-4" noValidate>
      <label className="block">
        <span className="mb-1 block font-semibold">{COPY.joinNameLabel}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoComplete="given-name"
          enterKeyHint="go"
          autoFocus
        />
      </label>
      {error && (
        <p className="font-semibold text-accent" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full text-2xl" disabled={busy}>
        {busy ? COPY.saving : COPY.joinButton}
      </button>
      <p className="text-center text-sm text-muted">{COPY.joinHint}</p>
    </form>
  );
}
