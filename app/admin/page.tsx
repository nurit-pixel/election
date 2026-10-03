import { isAdmin } from "@/lib/auth";
import { getResults, isLocked, lockAt } from "@/lib/data";
import { COPY } from "@/lib/copy";
import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";
import AdminPlayers from "@/components/AdminPlayers";
import AdminTabs from "@/components/AdminTabs";
import { listPlayers } from "@/lib/players";
import { listAllGroups } from "@/lib/groups";
import AdminGroups from "@/components/AdminGroups";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <>
        <TopBar />
        <h1 className="mb-4 text-5xl">{COPY.admin.title}</h1>
        <AdminLogin />
      </>
    );
  }
  const [results, players, groups] = await Promise.all([getResults(), listPlayers(), listAllGroups()]);
  return (
    <>
      <TopBar links={[{ href: "/me", label: COPY.toBoard }]} />
      <h1 className="mb-4 text-5xl">{COPY.admin.title}</h1>
      <AdminTabs
        results={<AdminPanel results={results} locked={isLocked(results)} lockAt={lockAt(results)} />}
        players={<AdminPlayers initial={players} />}
        groups={<AdminGroups initial={groups} />}
      />
    </>
  );
}
