import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups";

export const dynamic = "force-dynamic";

// הלוח הישן: מפנים לקבוצה הראשונה של השחקן (לרוב "מטה המאבק כוח 43"), או לדף הקבוצות
export default async function BoardRedirect() {
  const playerId = await getPlayerId();
  if (!playerId) redirect("/");
  const groups = await getMyGroups(playerId);
  redirect(groups.length ? `/g/${groups[0].slug}` : "/me");
}
