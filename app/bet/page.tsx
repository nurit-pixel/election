import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, getResults, isLocked, lockAt } from "@/lib/data";
import { COPY } from "@/lib/copy";
import BetForm from "@/components/BetForm";
import Countdown from "@/components/Countdown";
import TopBar from "@/components/TopBar";
import SwitchUser from "@/components/SwitchUser";

export const dynamic = "force-dynamic";

export default async function BetPage() {
  const playerId = await getPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;
  if (!player) redirect("/");
  const [bet, results] = await Promise.all([getBet(player.id), getResults()]);
  const locked = isLocked(results);

  return (
    <>
      <TopBar links={[{ href: "/me", label: COPY.toBoard }]} />
      <h1 className="text-5xl">היי {player.name}</h1>
      <SwitchUser name={player.name} />
      <Countdown lockAt={lockAt(results)} className="mb-6 mt-2 text-xl" />
      <BetForm
        playerId={player.id}
        locked={locked}
        initialBet={bet ? { seats: bet.seats, pm: bet.pm, bloc: bet.bloc, bonus: bet.bonus } : null}
      />
    </>
  );
}
