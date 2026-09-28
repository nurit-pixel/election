"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";

export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
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
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return setError(COPY.joinWrongCode);
      if (res.status === 409) return setError(COPY.joinNameTaken(data.name ?? name.trim()));
      if (!res.ok) return setError(COPY.genericError);
      router.push(data.hasBet ? "/done" : "/bet");
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
          enterKeyHint="next"
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-semibold">{COPY.joinCodeLabel}</span>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="ltr"
          enterKeyHint="go"
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
    </form>
  );
}
