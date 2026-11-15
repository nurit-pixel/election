"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

/** מעטפת האפליקציה: כותרת מותג, תוכן וניווט תחתון. מסך הכניסה מוצג בלי המעטפת. */
export function Shell({ unread, signedIn, children }: { unread: number; signedIn: boolean; children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/login")) return <>{children}</>;
  return (
    <>
      <a
        href="#content"
        className="pm-skip"
      >
        דילוג לתוכן
      </a>
      <header className="mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-pm-turquoise py-3">
          <Link href="/" aria-label="פראיירמטר – לרשימה">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="פראיירמטר" width={156} height={50} className="h-[50px] w-auto" />
          </Link>
          <Link
            href="/accessibility"
            aria-label="נגישות: גודל טקסט, ניגודיות והצהרת נגישות"
            className="flex min-h-11 items-center gap-1.5 rounded-[13px] border border-line bg-card px-3 text-sm font-bold"
          >
            <AccessibilityIcon />
            נגישות
          </Link>
        </div>
      </header>
      <main id="content" tabIndex={-1} className="mx-auto max-w-2xl px-4 pb-28 pt-6 outline-none has-[.pm-sticky-cta]:pb-48">
        {children}
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-28 text-center text-xs text-muted">
        <div className="border-t border-line pt-4">
          נבנה ע״י נורית תמם ·{" "}
          <Link href="/accessibility#statement" className="underline">
            הצהרת נגישות
          </Link>
        </div>
      </footer>
      {signedIn && <BottomNav unread={unread} />}
    </>
  );
}

function AccessibilityIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <path d="M4 8l8 1.5L20 8M12 9.5V15m0 0l-3.5 6M12 15l3.5 6" />
    </svg>
  );
}
