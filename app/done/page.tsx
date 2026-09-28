import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, isLocked } from "@/lib/data";
import { loadBoard } from "@/lib/board";
import { pmLabel, topParties } from "@/lib/betLabels";
import { COPY } from "@/lib/copy";
import PlayerCard from "@/components/PlayerCard";
import ShareActions from "@/components/ShareActions";
import TopBar from "@/components/TopBar";
import SwitchUser from "@/components/SwitchUser";

export const dynamic = "force-dynamic";

export default async function DonePage() {
  const playerId = await getPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;
  if (!player) redirect("/");
  const [bet, board] = await Promise.all([getBet(player.id), loadBoard()]);
  if (!bet) redirect("/bet");
  const { results, ranking, playerBadges } = board;
  const locked = isLocked(results);

  const plain = { seats: bet.seats, pm: bet.pm, bloc: bet.bloc, bonus: bet.bonus };
  const mine = results.mode !== "none" ? ranking.find((r) => r.player_id === player.id) : undefined;
  const top = topParties(plain, 1)[0];

  return (
    <>
      <TopBar links={[{ href: "/board", label: COPY.toBoard }]} />
      <h1 className="mb-2 text-5xl">{locked ? COPY.locked : COPY.submitted}</h1>
      <div className="mb-6">
        <SwitchUser name={player.name} />
      </div>
      <PlayerCard
        name={player.name}
        tier={mine ? mine.tier : null}
        total={mine?.total}
        place={mine?.place}
        pm={pmLabel(bet.pm)}
        topParty={top && { name: top.party.name, color: top.party.color, seats: top.seats, letters: top.party.letters }}
        bonusYes={Object.values(bet.bonus).filter(Boolean).length}
        badges={playerBadges[player.id] ?? []}
      />
      <h2 className="mb-3 mt-10 text-3xl">תמונה לקבוצה</h2>
      <ShareActions name={player.name} bet={plain} locked={locked} />
    </>
  );
}
