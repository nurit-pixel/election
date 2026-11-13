"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "רשימה", match: ["/", "/search", "/product"], icon: "M5 6h14M5 12h14M5 18h9" },
  { href: "/compare", label: "השוואה", match: ["/compare", "/store", "/split"], icon: "M12 4v16M5 8l-2 6h6L7 8M19 8l-2 6h6l-2-6M5 8h14" },
  { href: "/alerts", label: "התראות", match: ["/alerts"], icon: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 20h4" },
  { href: "/settings", label: "הגדרות", match: ["/settings"], icon: "M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6" },
];

/** ניווט ראשי בתחתית המסך, קרוב לאגודל: ארבעה יעדים עם אייקון ושם */
export function BottomNav({ unread }: { unread: number }) {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const active = item.match.some((m) => (m === "/" ? path === "/" : path.startsWith(m)));
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-bold text-ink" : "font-medium text-muted"
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
                {active && <span aria-hidden className="absolute top-0 h-1 w-10 rounded-b-full bg-pm-pink" />}
                {item.href === "/alerts" && unread > 0 && (
                  <span className="absolute top-1.5 ms-6 rounded-full bg-pm-pink px-1.5 text-[11px] font-bold text-white">
                    <span className="sr-only">התראות שלא נקראו: </span>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
