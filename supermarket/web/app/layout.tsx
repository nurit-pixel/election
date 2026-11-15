import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { unreadAlertCount } from "@/lib/tracking";
import { THEME_COOKIE } from "@/lib/theme";
import { A11Y_COOKIE, a11yAttributes, parseA11y } from "@/lib/a11y";
import { currentUserId } from "@/lib/session";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "פראיירמטר",
  description: "הסל המשפחתי, במחיר הנכון.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffcf7" },
    { media: "(prefers-color-scheme: dark)", color: "#200729" },
  ],
};

/** כשלא נבחר מצב בהגדרות, הולכים לפי המכשיר. רץ לפני הציור כדי שלא יהיה הבהוב. */
const SYSTEM_THEME = `try{if(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [unread, store, user] = await Promise.all([unreadAlertCount(), cookies(), currentUserId().catch(() => null)]);
  const a11y = a11yAttributes(parseA11y(store.get(A11Y_COOKIE)?.value));
  const chosen = store.get(THEME_COOKIE)?.value;
  const theme = chosen === "dark" || chosen === "light" ? chosen : undefined;

  return (
    <html lang="he" dir="rtl" data-theme={theme} {...a11y} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <Shell unread={unread} signedIn={user != null}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
