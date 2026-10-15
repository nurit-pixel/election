// מתזמן פנימי למד ההסלמה: השרת ב-Railway רץ ברציפות, אז בודקים כל 5 דקות אם הגיע זמן לסבב השעתי.
// אפשר לכבות עם IRAN_AUTO_REFRESH=off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.IRAN_AUTO_REFRESH === "off") return;
  const { isStale, runRefresh } = await import("@/lib/iran/refresh");
  const { latestSnapshot } = await import("@/lib/iran/store");
  const tick = async () => {
    try {
      const last = await latestSnapshot();
      if (isStale(last, 0)) await runRefresh();
    } catch (e) {
      console.error("[iran] refresh failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 5 * 60_000);
}
