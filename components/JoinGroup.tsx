"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// הצטרפות לפי קישור או קוד שהודבק
export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const slug = code.trim().split("/g/").pop()?.split(/[/?#]/)[0]?.toLowerCase() ?? "";

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!slug) return;
          const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/join`, { method: "POST" });
          if (res.status === 404) return setError("לא מצאנו קבוצה עם הקוד הזה.");
          if (!res.ok) return setError("משהו השתבש. נסו שוב.");
          router.push(`/g/${slug}`);
        }}
      >
        <input
          className="input flex-1"
          placeholder="קישור או קוד הזמנה"
          value={code}
          dir="ltr"
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          aria-label="קישור או קוד הזמנה"
        />
        <button className="btn btn-ink shrink-0" disabled={!slug}>
          הצטרפות
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// כפתור הצטרפות לקבוצה (מהרשימה הפתוחה או מדף ההזמנה)
export function JoinButton({ slug, label = "הצטרפות" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/groups/${slug}/join`, { method: "POST" });
        if (res.status === 401) return router.push(`/?next=/g/${slug}`);
        router.push(`/g/${slug}`);
        router.refresh();
      }}
    >
      {busy ? "מצטרפים…" : label}
    </button>
  );
}
