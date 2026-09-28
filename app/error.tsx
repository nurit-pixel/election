"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="box mt-10 space-y-4 p-6 text-center">
      <h1 className="text-4xl">משהו השתבש</h1>
      <p>המטה לא מצליח להתחבר לבסיס הנתונים כרגע.</p>
      <p className="text-base text-muted">
        למנהל/ת: פתחו את <a className="underline" href="/api/health" dir="ltr">/api/health</a> כדי לראות מה חסר.
      </p>
      <button className="btn btn-ink" onClick={reset}>
        לנסות שוב
      </button>
    </div>
  );
}
