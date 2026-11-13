import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|login|api/auth/|brand/|app-icon|icon|apple-icon|manifest.webmanifest).*)"],
};

export async function middleware(req: NextRequest) {
  if ((await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) != null) return NextResponse.next();
  return req.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", req.url));
}
