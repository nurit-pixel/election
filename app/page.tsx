import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, getResults, lockAt } from "@/lib/data";
import Countdown from "@/components/Countdown";
import JoinForm from "@/components/JoinForm";
import Logo from "@/components/Logo";
import Timeline from "@/components/Timeline";

export const dynamic = "force-dynamic";

export default async function Home() {
  const playerId = await getPlayerId();
  if (playerId && (await getPlayer(playerId))) {
    redirect((await getBet(playerId)) ? "/done" : "/bet");
  }
  const results = await getResults();
  const lock = lockAt(results);

  return (
    <div className="space-y-6">
      <Logo big />
      <Countdown lockAt={lock} className="text-center text-2xl" />
      <JoinForm />
      <Timeline lockAt={lock} />
    </div>
  );
}
