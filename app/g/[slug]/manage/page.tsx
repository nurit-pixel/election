import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlayerId, isAdmin } from "@/lib/auth";
import { getResults, isLocked } from "@/lib/data";
import { getGroupBySlug, getMembers, getQuestions } from "@/lib/groups";
import GroupForm from "@/components/GroupForm";
import InviteShare from "@/components/InviteShare";
import { DeleteGroup, MembersManager, QuestionsManager } from "@/components/GroupManage";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function ManageGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [playerId, admin] = await Promise.all([getPlayerId(), isAdmin()]);
  if (!playerId && !admin) redirect(`/?next=/g/${slug}/manage`);
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  if (!admin && group.owner_id !== playerId) redirect(`/g/${slug}`);

  const [members, questions, results] = await Promise.all([getMembers(group.id), getQuestions(group.id), getResults()]);
  const locked = isLocked(results);

  return (
    <>
      <TopBar links={[{ href: `/g/${group.slug}`, label: "חזרה לקבוצה" }]} />
      <h1 className="mb-6 text-4xl">
        ניהול: {group.emoji} {group.name}
      </h1>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl">הזמנה</h2>
        <InviteShare slug={group.slug} name={group.name} emoji={group.emoji} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl">הגדרות</h2>
        <GroupForm slug={group.slug} initial={{ name: group.name, emoji: group.emoji, color: group.color, is_public: group.is_public }} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl">שאלות בונוס של הקבוצה</h2>
        <QuestionsManager slug={group.slug} initial={questions} locked={locked} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl">משתתפים ({members.length})</h2>
        <MembersManager slug={group.slug} ownerId={group.owner_id} initial={members} />
      </section>

      <section className="mb-6">
        <DeleteGroup slug={group.slug} name={group.name} />
      </section>
      <p className="text-center">
        <Link href={`/g/${group.slug}`} className="text-cyan underline underline-offset-4">
          חזרה לקבוצה
        </Link>
      </p>
    </>
  );
}
