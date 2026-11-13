import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { unreadAlertCount } from "@/lib/tracking";
import "./globals.css";

export const metadata: Metadata = {
  title: "השוואת סל",
  description: "השוואת מחירי סל קניות בין סופרמרקטים",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const unread = await unreadAlertCount();
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-emerald-700">
              השוואת סל
            </Link>
            <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <Link href="/">רשימה</Link>
              <Link href="/compare">השוואה</Link>
              <Link href="/alerts" className="flex items-center gap-1">
                התראות
                {unread > 0 && (
                  <span className="rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/settings">הגדרות</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
