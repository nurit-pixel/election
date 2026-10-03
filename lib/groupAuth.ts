import "server-only";
import { NextResponse } from "next/server";
import { getPlayerId, isAdmin } from "./auth";
import { getGroupBySlug, isMember, type Group } from "./groups";

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; res: NextResponse };
const fail = (status: number, error: string): Fail => ({ ok: false, res: NextResponse.json({ error }, { status }) });

export async function requirePlayer(): Promise<Ok<{ playerId: string }> | Fail> {
  const playerId = await getPlayerId();
  return playerId ? { ok: true, playerId } : fail(401, "unauthorized");
}

/** קבוצה + השחקן המחובר. manage=true דורש בעלות על הקבוצה (או אדמין ראשי). */
export async function requireGroup(
  slug: string,
  opts: { manage?: boolean; member?: boolean } = {},
): Promise<Ok<{ group: Group; playerId: string | null; admin: boolean }> | Fail> {
  const group = await getGroupBySlug(slug);
  if (!group) return fail(404, "not_found");
  const [playerId, admin] = await Promise.all([getPlayerId(), isAdmin()]);
  if (opts.manage && !admin && (!playerId || group.owner_id !== playerId)) return fail(403, "forbidden");
  if (opts.member && !admin && (!playerId || !(await isMember(group.id, playerId)))) return fail(403, "not_member");
  return { ok: true, group, playerId, admin };
}
