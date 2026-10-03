"use client";

import { useState } from "react";

// שיתוף קישור ההזמנה: navigator.share בטלפון, אחרת העתקה
export default function InviteShare({ slug, name, emoji }: { slug: string; name: string; emoji: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/g/${slug}` : `/g/${slug}`;
  const text = `${emoji} הצטרפו לקבוצה "${name}" בליל המדגמים — מנחשים את הכנסת הבאה ונראה מי צודק/ת!`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-primary w-full text-lg" onClick={share}>
        {copied ? "הקישור הועתק ✓" : "📨 הזמנת חברים"}
      </button>
      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        קוד הזמנה:
        <code dir="ltr" className="chip px-2 py-0 font-mono text-cyan">
          {slug}
        </code>
      </div>
    </div>
  );
}
