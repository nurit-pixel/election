import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlayerId, isAdmin } from "@/lib/auth";
import { getBet, getResults, isLocked } from "@/lib/data";
import { getAnswers, getGroupBySlug, getMembers, isMember } from "@/lib/groups";
import { loadBoard } from "@/lib/board";
import AutoRefresh from "@/components/AutoRefresh";
import BoardView from "@/components/BoardView";
import GroupAnswers from "@/components/GroupAnswers";
import InviteShare from "@/components/InviteShare";
import { JoinButton } from "@/components/JoinGroup";
import LeaveGroup from "@/components/LeaveGroup";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> };

export default async function GroupPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { created } = await searchParams;
  const [playerId, admin] = await Promise.all([getPlayerId(), isAdmin()]);
  if (!playerId && !admin) redirect(`/?next=/g/${slug}`);

  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  const member = playerId ? await isMember(group.id, playerId) : false;
  const owner = !!playerId && group.owner_id === playerId;

  const header = (
    <div className="mb-6 flex items-center gap-4">
      <span
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-5xl"
        style={{ background: `${group.color}22`, boxShadow: `0 0 40px ${group.color}55, inset 0 0 0 1px ${group.color}88` }}
      >
        {group.emoji}
      </span>
      <div className="min-w-0">
        <h1 className="text-4xl leading-tight" style={{ textShadow: `0 0 24px ${group.color}66` }}>
          {group.name}
        </h1>
        <p className="text-sm text-muted">{group.is_public ? "🌍 קבוצה פתוחה" : "🔒 קבוצה פרטית"}</p>
      </div>
    </div>
  );

  // לא חבר/ה — מסך הזמנה
  if (!member && !admin) {
    const members = await getMembers(group.id);
    return (
      <>
        <TopBar links={[{ href: "/me", label: "הקבוצות שלי" }]} />
        {header}
        <div className="box space-y-4 p-5 text-center">
          <p className="text-xl">הוזמנת להצטרף! 🎉</p>
          <p className="text-muted">{members.length} משתתפים כבר בפנים. ההימור שלך ייספר גם כאן.</p>
          <JoinButton slug={group.slug} label="הצטרפות לקבוצה" />
        </div>
      </>
    );
  }

  const [data, results, bet] = await Promise.all([loadBoard(group.id), getResults(), playerId ? getBet(playerId) : null]);
  const locked = isLocked(results);
  const myAnswers = playerId && data.questions.length ? (await getAnswers(data.questions.map((q) => q.id)))[playerId] ?? {} : {};

  return (
    <>
      <AutoRefresh seconds={60} />
      <TopBar links={[{ href: "/me", label: "הקבוצות שלי" }]} />
      {header}

      {created && (
        <p className="box mb-4 border-ok/50 p-3 text-center">
          הקבוצה נוצרה! 🎉 עכשיו שלחו את הקישור לחברים.
        </p>
      )}

      <section className="mb-8 space-y-3">
        <InviteShare slug={group.slug} name={group.name} emoji={group.emoji} />
        <div className="flex items-center justify-center gap-4">
          {(owner || admin) && (
            <Link href={`/g/${group.slug}/manage`} className="text-sm text-cyan underline underline-offset-4">
              ⚙️ ניהול הקבוצה
            </Link>
          )}
          {member && !owner && <LeaveGroup slug={group.slug} name={group.name} />}
        </div>
      </section>

      {member && !bet && !locked && (
        <Link href="/bet" className="box mb-8 block p-4 text-center no-underline" style={{ borderColor: "rgb(255 45 85 / 0.55)" }}>
          <span className="block font-display text-2xl glow-red">עוד לא הגשת הימור</span>
          <span className="text-muted">לחצו כאן — 3 דקות, ונכנסים לדירוג של הקבוצה</span>
        </Link>
      )}

      {data.questions.length > 0 && member && (
        <section className="mb-8">
          <h2 className="mb-1 text-3xl">שאלות הבונוס של הקבוצה</h2>
          <p className="mb-3 text-sm text-muted">בקבוצה הזו השאלות האלה מחליפות את שאלות הבונוס הכלליות.</p>
          <GroupAnswers slug={group.slug} questions={data.questions} initial={myAnswers} locked={locked} />
        </section>
      )}

      <BoardView data={data} />
    </>
  );
}
