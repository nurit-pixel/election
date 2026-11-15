"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const toKey = (base64url: string) => {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** הפעלה וכיבוי של התראות מחיר לטלפון במכשיר הנוכחי. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push")).json();
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("save failed");
      await registration.showNotification("פראיירמטר", {
        body: "התראות המחיר הופעלו במכשיר הזה.",
        icon: "/app-icon-192.png",
        dir: "rtl",
        lang: "he",
      });
      setState("on");
    } catch {
      setError("לא הצלחנו להפעיל התראות במכשיר הזה. מנסים שוב, או בודקים את הגדרות ההתראות של הדפדפן.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  return (
    <div className="rounded-pm-lg border border-line bg-card p-4 text-sm shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold">התראות לטלפון</div>
          <div className="text-muted">
            {state === "on" && "פעילות במכשיר הזה: הודעה כשמחיר יורד או משתנה."}
            {state === "off" && "הודעה לטלפון כשמחיר יורד או משתנה, בלי להיכנס לאפליקציה."}
            {state === "denied" && "ההתראות חסומות בדפדפן. מאפשרים אותן בהגדרות האתר ומרעננים."}
            {state === "unsupported" && "הדפדפן הזה לא תומך בהתראות. בכרום או בספארי מעודכן זה עובד."}
            {state === "ios-install" &&
              "באייפון: מוסיפים קודם את האפליקציה למסך הבית (כפתור השיתוף ← ״הוסף למסך הבית״), פותחים משם, ומפעילים כאן."}
          </div>
        </div>
        {(state === "off" || state === "on") && (
          <button
            onClick={state === "on" ? disable : enable}
            disabled={busy}
            aria-pressed={state === "on"}
            className={`min-h-11 shrink-0 rounded-[13px] px-4 font-bold disabled:opacity-60 ${
              state === "on" ? "bg-subtle" : "bg-primary text-on-primary"
            }`}
          >
            {busy ? "רגע…" : state === "on" ? "כיבוי" : "הפעלה"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-missing">
          {error}
        </p>
      )}
    </div>
  );
}
