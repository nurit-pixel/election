import { NextRequest, NextResponse } from "next/server";
import { googleConfigured } from "@/lib/auth";
import { appOrigin, authorizationUrl, STATE_COOKIE } from "@/lib/google";

export const dynamic = "force-dynamic";

/** תחילת הכניסה: מעבר למסך בחירת החשבון של Google. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req.headers);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/login?error=config`);
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authorizationUrl(origin, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
