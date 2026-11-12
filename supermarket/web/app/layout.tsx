import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "השוואת סל",
  description: "השוואת מחירי סל קניות בין סופרמרקטים",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-emerald-700">
              השוואת סל
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-slate-600">
              <Link href="/">הרשימה שלי</Link>
              <Link href="/compare">השוואה</Link>
              <Link href="/settings">הגדרות</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
