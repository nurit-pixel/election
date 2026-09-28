import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, getResults, lockAt } from "@/lib/data";
import { COPY } from "@/lib/copy";
import Countdown from "@/components/Countdown";
import JoinForm from "@/components/JoinForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const playerId = await getPlayerId();
  if (playerId && (await getPlayer(playerId))) {
    redirect((await getBet(playerId)) ? "/done" : "/bet");
  }
  const results = await getResults();

  return (
    <div className="space-y-6">
      <Logo big />
      <Countdown lockAt={lockAt(results)} className="text-center text-2xl" />
      <JoinForm />
      <p className="text-center text-base opacity-80">{COPY.joinPrivacy}</p>
    </div>
  );
}
