"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

/** מעטפת האפליקציה: כותרת מותג, תוכן וניווט תחתון. מסך הכניסה מוצג בלי המעטפת. */
export function Shell({ unread, children }: { unread: number; children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/login")) return <>{children}</>;
  return (
    <>
      <header className="mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-pm-turquoise py-3">
          <Link href="/" aria-label="פראיירמטר – לרשימה">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="פראיירמטר" width={156} height={50} className="h-[50px] w-auto" />
          </Link>
          <span className="max-w-24 text-left text-xs leading-normal text-muted">הקניות של המשפחה</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 has-[.pm-sticky-cta]:pb-48">
        {children}
        <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">נבנה ע״י נורית תמם</footer>
      </main>
      <BottomNav unread={unread} />
    </>
  );
}
