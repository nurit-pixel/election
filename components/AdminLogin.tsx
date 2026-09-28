"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return setError(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="box space-y-4 p-4">
      <label className="block">
        <span className="mb-1 block font-semibold">{COPY.admin.codeLabel}</span>
        <input className="input" type="password" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      {error && <p className="text-accent">{COPY.adminWrongCode}</p>}
      <button className="btn btn-ink w-full">{COPY.admin.enter}</button>
    </form>
  );
}
