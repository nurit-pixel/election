import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, familyPassword, safeEqual, sessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!familyPassword() || !safeEqual(password, familyPassword())) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // האטה של ניחושים
    redirect("/login?error=1");
  }
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="min-h-dvh bg-pm-cream text-pm-purple">
      <div className="relative bg-pm-purple pb-16 pt-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.svg" alt="" aria-hidden width={224} height={168} className="mx-auto" />
        <div className="mt-3 font-display text-5xl font-black">
          <span className="text-pm-orange">פראייר</span>
          <span className="text-pm-turquoise">מטר</span>
        </div>
        <svg aria-hidden viewBox="0 0 390 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-10 w-full">
          <path d="M0 14C70 44 150 36 205 18S330 -6 390 12V40H0Z" fill="#fff9f4" />
        </svg>
      </div>

      <form action={login} className="mx-auto max-w-sm space-y-4 px-6 pb-10 pt-4">
        <div className="text-center">
          <h1 className="text-3xl font-black">לא יוצאים פראיירים.</h1>
          <p className="mt-1 text-[#655a6b]">משווים את הסל. רואים מה חסר. בוחרים חכם.</p>
          <p className="mt-2 text-xs text-[#8d1b42]">גיל עוד צוחק; נורית בנתה אפליקציה.</p>
        </div>

        {!familyPassword() && (
          <p className="rounded-pm bg-[#fff7d6] p-3 text-sm text-[#725000]">
            לא הוגדרה סיסמה. מגדירים FAMILY_PASSWORD בקובץ ‎.env.
          </p>
        )}

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
            הסיסמה המשפחתית
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="w-full rounded-pm border-2 border-[#d7cdd9] bg-white px-4 py-3.5 text-base text-pm-purple"
          />
          {error && (
            <p id="login-error" role="alert" className="mt-1.5 text-sm font-medium text-[#8d1b42]">
              הסיסמה לא נכונה. מנסים שוב?
            </p>
          )}
        </div>

        <button className="min-h-12 w-full rounded-pm bg-pm-purple px-5 py-3.5 text-lg font-bold text-white">
          כניסה
        </button>
      </form>
    </div>
  );
}
