import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getBet, getPlayer, getResults, isLocked, lockAt } from "@/lib/data";
import { getMyGroups, listPublicGroups } from "@/lib/groups";
import { pmLabel, topParties } from "@/lib/betLabels";
import Countdown from "@/components/Countdown";
import GroupCard from "@/components/GroupCard";
import { JoinButton, JoinByCode } from "@/components/JoinGroup";
import SwitchUser from "@/components/SwitchUser";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const playerId = await getPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;
  if (!player) redirect("/");
  const [bet, results, groups, publicGroups] = await Promise.all([
    getBet(player.id),
    getResults(),
    getMyGroups(player.id),
    listPublicGroups(player.id),
  ]);
  const locked = isLocked(results);
  const top = bet ? topParties(bet, 1)[0] : undefined;

  return (
    <>
      <TopBar />
      <h1 className="text-5xl">היי {player.name}</h1>
      <SwitchUser name={player.name} />
      <Countdown lockAt={lockAt(results)} className="my-5" />

      {/* ההימור */}
      <section className="box mb-8 p-4" style={{ borderColor: bet ? "rgb(30 229 138 / 0.5)" : "rgb(255 45 85 / 0.55)" }}>
        {bet ? (
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl">ההימור שלך נרשם</div>
              <div className="truncate text-sm text-muted">
                רה&quot;מ: {pmLabel(bet.pm)}
                {top ? ` · ${top.party.name} ${top.seats}` : ""}
              </div>
            </div>
            <Link href={locked ? "/done" : "/bet"} className="btn btn-ink shrink-0 text-base">
              {locked ? "הכרטיס שלי" : "עדכון"}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-display text-2xl glow-red">{locked ? "הקלפיות נסגרו" : "עוד לא הגשת הימור"}</div>
            {!locked && (
              <Link href="/bet" className="btn btn-primary w-full text-xl">
                למילוי ההימור (3 דקות)
              </Link>
            )}
          </div>
        )}
      </section>

      {/* הקבוצות שלי */}
      <section className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">הקבוצות שלי</h2>
          <Link href="/groups/new" className="btn btn-primary min-h-11 text-base">
            + קבוצה חדשה
          </Link>
        </div>
        {groups.length ? (
          groups.map((g) => <GroupCard key={g.id} group={g} badge={g.owner_id === player.id ? "מנהל/ת" : undefined} />)
        ) : (
          <p className="box p-4 text-muted">עוד אין לך קבוצות. פתחו קבוצה ושלחו את הקישור לחברים, או הצטרפו לאחת למטה.</p>
        )}
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="text-2xl">יש לך קישור הזמנה?</h2>
        <JoinByCode />
      </section>

      {publicGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl">קבוצות פתוחות</h2>
          {publicGroups.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <GroupCard group={g} />
              </div>
              <JoinButton slug={g.slug} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
