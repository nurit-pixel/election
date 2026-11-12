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
    <form action={login} className="mx-auto mt-16 max-w-xs space-y-3">
      <h1 className="text-center text-xl font-bold">כניסה</h1>
      {!familyPassword() && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          לא הוגדרה סיסמה. הגדירו FAMILY_PASSWORD בקובץ ‎.env.
        </p>
      )}
      <input
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        placeholder="הסיסמה המשפחתית"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
      />
      {error && <p className="text-sm text-rose-600">סיסמה שגויה</p>}
      <button className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">כניסה</button>
    </form>
  );
}
