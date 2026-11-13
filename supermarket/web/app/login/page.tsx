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
    <div className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="פראיירמטר" width={720} height={233} className="mx-auto my-8 h-auto w-full max-w-[330px]" />
      <h1 className="mx-auto max-w-[310px] text-center underline decoration-pm-pink decoration-[5px] underline-offset-[7px]">
        הסל המשפחתי, במחיר הנכון.
      </h1>
      <p className="mx-auto mb-7 mt-6 max-w-[290px] text-center text-sm leading-relaxed text-muted">
        נכנסים עם הסיסמה המשותפת ומתחילים להשוות.
      </p>

      <form
        action={login}
        className="relative space-y-4 overflow-hidden rounded-3xl border-2 border-[var(--pm-button-edge)] bg-card px-5 pb-6 pt-8 shadow-[5px_5px_0_var(--pm-turquoise)] dark:shadow-[5px_5px_0_var(--pm-hot-pink)]"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[7px] bg-[linear-gradient(90deg,var(--pm-turquoise)_0_34%,var(--pm-orange)_34%_67%,var(--pm-hot-pink)_67%)]"
        />
        {!familyPassword() && (
          <p className="rounded-pm bg-aging-surface p-3 text-sm text-aging">
            לא הוגדרה סיסמה. מגדירים FAMILY_PASSWORD בקובץ ‎.env.
          </p>
        )}

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
            סיסמה משפחתית
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
            className={`min-h-[52px] w-full rounded-[13px] border bg-card px-4 text-base text-ink ${error ? "border-missing" : "border-line"}`}
          />
          {error && (
            <p id="login-error" role="alert" className="mt-1.5 text-sm font-medium text-missing">
              הסיסמה לא נכונה. מנסים שוב?
            </p>
          )}
        </div>

        <button className="min-h-[52px] w-full rounded-pm bg-primary px-5 text-base text-on-primary">כניסה לרשימה שלי</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">נורית בנתה. גילי כבר חוסכת.</p>
    </div>
  );
}
