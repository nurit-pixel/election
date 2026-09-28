import type { Metadata, Viewport } from "next";
import { Assistant, Secular_One } from "next/font/google";
import { COPY } from "@/lib/copy";
import "./globals.css";

const secular = Secular_One({ weight: "400", subsets: ["hebrew", "latin"], variable: "--font-secular", display: "swap" });
const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });

export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.subtitle,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5EFE0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${secular.variable} ${assistant.variable}`}>
      <body className="min-h-dvh">
        <main className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
