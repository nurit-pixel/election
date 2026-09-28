"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { COPY } from "@/lib/copy";
import type { Bet } from "@/lib/scoring";
import ShareCard from "./ShareCard";

export default function ShareActions({ name, bet, locked }: { name: string; bet: Bet; locked: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // התאמת התצוגה המוקטנת לרוחב המסך
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1080));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function share() {
    if (!cardRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await document.fonts?.ready;
      const dataUrl = await toPng(cardRef.current, { width: 1080, height: 1080, pixelRatio: 1, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "koach43.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: COPY.title });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "koach43.png";
      a.click();
    } catch {
      setError(COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div ref={boxRef} className="box relative w-full overflow-hidden" style={{ height: 1080 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", position: "absolute", top: 0, right: 0 }}>
          <ShareCard ref={cardRef} name={name} bet={bet} />
        </div>
      </div>

      <button type="button" className="btn btn-primary w-full text-2xl" onClick={share} disabled={busy}>
        {busy ? COPY.downloading : COPY.share}
      </button>
      {error && <p className="text-accent">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {!locked && (
          <Link href="/bet" className="btn">
            {COPY.edit}
          </Link>
        )}
        <Link href="/board" className={`btn btn-ink ${locked ? "col-span-2" : ""}`}>
          {COPY.toBoard}
        </Link>
      </div>
    </div>
  );
}
