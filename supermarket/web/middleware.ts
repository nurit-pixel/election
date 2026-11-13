import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, familyPassword, safeEqual, sessionToken } from "@/lib/auth";

export const config = { matcher: ["/((?!_next/|favicon.ico|login|brand/|app-icon|icon|apple-icon|manifest.webmanifest).*)"] };

export async function middleware(req: NextRequest) {
  const fail = () =>
    req.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  if (!familyPassword()) return fail(); // בלי סיסמה מוגדרת אין כניסה
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  return safeEqual(cookie, await sessionToken()) ? NextResponse.next() : fail();
}
