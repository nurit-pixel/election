"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/** סריקת ברקוד במצלמה. BarcodeDetector אם הדפדפן תומך, אחרת ספריית ZXing. */
export function BarcodeScanner({ itemId }: { itemId?: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let stopZxing: (() => void) | undefined;

    const found = (code: string) => {
      if (stopped || !/^\d{6,14}$/.test(code)) return;
      stopped = true;
      setOpen(false);
      router.push(`/search?q=${code}${itemId ? `&item=${itemId}` : ""}`);
    };

    (async () => {
      try {
        const video = videoRef.current!;
        const Native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
        if (Native) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          video.srcObject = stream;
          await video.play();
          const detector = new Native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
          while (!stopped) {
            const codes = await detector.detect(video).catch(() => []);
            if (codes[0]) found(codes[0].rawValue);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const controls = await new BrowserMultiFormatReader().decodeFromConstraints(
            { video: { facingMode: "environment" } },
            video,
            (result) => result && found(result.getText()),
          );
          stopZxing = () => controls.stop();
          if (stopped) controls.stop();
        }
      } catch {
        setError("אין גישה למצלמה. אפשר להקליד את הברקוד בשדה החיפוש.");
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
      stopZxing?.();
    };
  }, [open, itemId, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="rounded-pm bg-primary px-4 py-3 text-on-primary"
      >
        סריקה
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-label="סריקת ברקוד">
          <div className="flex items-center justify-between text-white">
            <span className="font-semibold">כוונו את המצלמה לברקוד</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/40 px-3 py-1.5">
              סגירה
            </button>
          </div>
          <video ref={videoRef} playsInline muted className="mt-4 min-h-0 flex-1 rounded-pm object-cover" />
          {error && <p className="mt-3 rounded-pm bg-card p-3 text-sm text-missing">{error}</p>}
        </div>
      )}
    </>
  );
}
