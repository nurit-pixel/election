import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { unreadAlertCount } from "@/lib/tracking";
import { THEME_COOKIE } from "@/lib/theme";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "פראיירמטר",
  description: "משווים את הסל. רואים מה חסר. בוחרים חכם.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#30003f" },
    { media: "(prefers-color-scheme: dark)", color: "#17081f" },
  ],
};

/** כשלא נבחר מצב בהגדרות, הולכים לפי המכשיר. רץ לפני הציור כדי שלא יהיה הבהוב. */
const SYSTEM_THEME = `try{if(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [unread, store] = await Promise.all([unreadAlertCount(), cookies()]);
  const chosen = store.get(THEME_COOKIE)?.value;
  const theme = chosen === "dark" || chosen === "light" ? chosen : undefined;

  return (
    <html lang="he" dir="rtl" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <Shell unread={unread}>{children}</Shell>
      </body>
    </html>
  );
}
