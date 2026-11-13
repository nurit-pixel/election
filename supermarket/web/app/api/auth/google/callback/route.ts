import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, safeEqual, sessionToken } from "@/lib/auth";
import { appOrigin, exchangeCode, STATE_COOKIE } from "@/lib/google";
import { emailAllowed, signInGoogleUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** החזרה מ-Google: בדיקת ה-state, זיהוי החשבון ופתיחת סשן. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req.headers);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${origin}/login?error=${reason}`);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const expected = req.cookies.get(STATE_COOKIE)?.value ?? "";
  if (req.nextUrl.searchParams.get("error")) return fail("cancelled");
  if (!code || !expected || !safeEqual(state, expected)) return fail("state");

  let profile;
  try {
    profile = await exchangeCode(code, origin);
  } catch (error) {
    console.error("google: token request failed", error);
    return fail("google");
  }
  if (!profile) return fail("google");
  if (!emailAllowed(profile.email)) return fail("denied");

  const userId = await signInGoogleUser(profile);
  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.set(SESSION_COOKIE, await sessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
