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
      <header className="bg-pm-purple text-white">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2" aria-label="פראיירמטר – לרשימה">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" aria-hidden width={36} height={27} />
            <span className="font-display text-xl font-extrabold">
              <span className="text-pm-orange">פראייר</span>
              <span className="text-pm-turquoise">מטר</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">{children}</main>
      <BottomNav unread={unread} />
    </>
  );
}
