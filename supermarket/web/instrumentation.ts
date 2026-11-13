/** שגיאות שרת שלא נתפסו נרשמות ליומן, כדי שיופיעו במסך הניהול. */
export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  // הרישום משתמש במסד הנתונים, ולכן רק בסביבת Node (לא ב-middleware)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logEvent } = await import("./lib/log");
    const err = error as { message?: string; digest?: string; stack?: string };
    // כתובת הדף בלי פרמטרים, כדי לא לשמור טקסט שהמשתמש הקליד
    const path = request.path.split("?")[0];
    await logEvent("error", "server_error", `${request.method} ${context.routePath ?? path}: ${err?.message ?? String(error)}`, {
      details: [err?.digest && `digest ${err.digest}`, err?.stack?.split("\n").slice(0, 6).join("\n")].filter(Boolean).join("\n"),
    });
  }
}
