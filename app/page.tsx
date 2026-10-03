import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getPlayer, getResults, lockAt } from "@/lib/data";
import Countdown from "@/components/Countdown";
import LoginForm from "@/components/LoginForm";
import Logo from "@/components/Logo";
import Timeline from "@/components/Timeline";

export const dynamic = "force-dynamic";

// רק נתיבים פנימיים (מונע הפניה לאתר חיצוני דרך ?next=)
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/me");

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const playerId = await getPlayerId();
  if (playerId && (await getPlayer(playerId))) redirect(next);
  const results = await getResults();
  const lock = lockAt(results);

  return (
    <div className="space-y-6">
      <Logo big />
      <Countdown lockAt={lock} className="text-center text-2xl" />
      {next.startsWith("/g/") && <p className="box border-cyan/50 p-3 text-center">הוזמנת לקבוצה! נכנסים ומצטרפים 👇</p>}
      <LoginForm next={next} />
      <section className="box p-5">
        <h2 className="mb-3 text-2xl">איך זה עובד?</h2>
        <ol className="space-y-2 text-base">
          <li>🗳️ ממלאים הימור אחד: 120 מנדטים, ראש ממשלה, גוש ובונוסים.</li>
          <li>👥 פותחים קבוצה (חברים, משפחה, עבודה) ושולחים קישור — או מצטרפים לקבוצה פתוחה.</li>
          <li>📺 בליל הבחירות כל קבוצה מקבלת דירוג חי משלה.</li>
          <li>🏆 משחקים על נקודות וכבוד בלבד. בלי כסף.</li>
        </ol>
      </section>
      <Timeline lockAt={lock} />
    </div>
  );
}
