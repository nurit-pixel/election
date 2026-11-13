import { Quip } from "@/components/Quip";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, familyPassword, googleConfigured, safeEqual, sessionToken } from "@/lib/auth";
import { currentUserId } from "@/lib/session";
import { logEvent } from "@/lib/log";
import { signInFamilyUser } from "@/lib/users";

/** כניסה זמנית בסיסמה המשפחתית, לחשבון משותף אחד. פעילה רק עד שמוגדרת כניסה עם Google. */
async function passwordLogin(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!familyPassword() || !safeEqual(password, familyPassword())) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // האטה של ניחושים
    await logEvent("error", "login_failed", "סיסמה משפחתית שגויה");
    redirect("/login?error=password");
  }
  const https = (await headers()).get("x-forwarded-proto") === "https";
  const { id } = await signInFamilyUser();
  await logEvent("info", "login", "כניסה בסיסמה המשפחתית", { userId: id });
  (await cookies()).set(SESSION_COOKIE, await sessionToken(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
  redirect("/");
}

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  cancelled: "הכניסה בוטלה. אפשר לנסות שוב.",
  state: "הכניסה לא הושלמה. מנסים שוב?",
  google: "לא הצלחנו לאמת את החשבון מול Google. מנסים שוב בעוד רגע.",
  denied: "החשבון הזה לא מורשה להיכנס לאפליקציה.",
  config: "הכניסה עם Google עוד לא הוגדרה בשרת.",
  password: "הסיסמה לא נכונה. מנסים שוב?",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await currentUserId()) != null) redirect("/");
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.google) : null;
  return (
    <div className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="פראיירמטר" width={720} height={233} className="mx-auto my-8 h-auto w-full max-w-[330px]" />
      <h1 className="mx-auto max-w-[310px] text-center underline decoration-pm-pink decoration-[5px] underline-offset-[7px]">
        הסל המשפחתי, במחיר הנכון.
      </h1>
      <p className="mx-auto mb-7 mt-6 max-w-[290px] text-center text-sm leading-relaxed text-muted">
        נכנסים עם חשבון Google. לכל אחד הרשימה, הכתובות וההגדרות שלו.
      </p>

      <div className="relative space-y-4 overflow-hidden rounded-3xl border-2 border-[var(--pm-button-edge)] bg-card px-5 pb-6 pt-8 shadow-[5px_5px_0_var(--pm-turquoise)] dark:shadow-[5px_5px_0_var(--pm-hot-pink)]">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[7px] bg-[linear-gradient(90deg,var(--pm-turquoise)_0_34%,var(--pm-orange)_34%_67%,var(--pm-hot-pink)_67%)]"
        />
        {message && (
          <p id="login-error" role="alert" className="rounded-pm bg-missing-surface p-3 text-sm font-medium text-missing">
            {message}
          </p>
        )}
        {googleConfigured() ? (
          <a
            href="/api/auth/google"
            className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-pm bg-primary px-5 text-base text-on-primary"
          >
            <GoogleMark />
            כניסה עם Google
          </a>
        ) : familyPassword() ? (
          <form action={passwordLogin} className="space-y-4">
            <p className="rounded-pm bg-aging-surface p-3 text-sm text-aging">
              כניסה זמנית בסיסמה המשפחתית. אחרי שמגדירים GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET בשרת (ההסבר
              ב-DEPLOY.md), הכניסה עוברת ל-Google והנתונים הקיימים עוברים לחשבון הראשון שנכנס.
            </p>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
                סיסמה משפחתית
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="min-h-[52px] w-full rounded-[13px] border border-line bg-card px-4 text-base text-ink"
              />
            </div>
            <button className="min-h-[52px] w-full rounded-pm bg-primary px-5 text-base text-on-primary">כניסה לרשימה שלי</button>
          </form>
        ) : (
          <p className="rounded-pm bg-aging-surface p-3 text-sm text-aging">
            חסרים GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET בקובץ ‎.env בשרת. ההסבר בקובץ DEPLOY.md.
          </p>
        )}
      </div>
      <Quip place="login" className="mt-7" />
      <p className="mt-3 text-center text-xs text-muted">נורית בנתה. גילי כבר חוסכת.</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden className="rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.1-10.3 7.1-17.7z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
