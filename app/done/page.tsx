import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, getResults, isLocked } from "@/lib/data";
import { COPY } from "@/lib/copy";
import ShareActions from "@/components/ShareActions";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function DonePage() {
  const playerId = await getPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;
  if (!player) redirect("/");
  const [bet, results] = await Promise.all([getBet(player.id), getResults()]);
  if (!bet) redirect("/bet");
  const locked = isLocked(results);

  return (
    <>
      <TopBar />
      <h1 className="mb-2 text-5xl">{locked ? COPY.locked : COPY.submitted}</h1>
      <div className="mt-6">
        <ShareActions name={player.name} bet={{ seats: bet.seats, pm: bet.pm, bloc: bet.bloc, bonus: bet.bonus }} locked={locked} />
      </div>
    </>
  );
}
