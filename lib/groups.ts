import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseServer } from "./supabase";
import { newSlug, type GroupQuestion } from "./groupScore";

export type Group = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  is_public: boolean;
  owner_id: string | null;
  created_at: string;
};

export type GroupWithCount = Group & { members: number };

const db = () => supabaseServer();

export async function getGroupBySlug(slug: string): Promise<Group | null> {
  const { data } = await db().from("groups").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  return data;
}

export async function isMember(groupId: string, playerId: string): Promise<boolean> {
  const { count } = await db()
    .from("group_members")
    .select("player_id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("player_id", playerId);
  return !!count;
}

async function withCounts(groups: Group[]): Promise<GroupWithCount[]> {
  if (!groups.length) return [];
  const { data } = await db().from("group_members").select("group_id").in("group_id", groups.map((g) => g.id));
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.group_id, (counts.get(r.group_id) ?? 0) + 1);
  return groups.map((g) => ({ ...g, members: counts.get(g.id) ?? 0 }));
}

export async function getMyGroups(playerId: string): Promise<GroupWithCount[]> {
  const { data: rows } = await db().from("group_members").select("group_id").eq("player_id", playerId);
  const ids = (rows ?? []).map((r) => r.group_id);
  if (!ids.length) return [];
  const { data } = await db().from("groups").select("*").in("id", ids).order("created_at");
  return withCounts(data ?? []);
}

export async function listPublicGroups(excludeFor?: string): Promise<GroupWithCount[]> {
  const { data } = await db().from("groups").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(50);
  let groups = data ?? [];
  if (excludeFor) {
    const mine = new Set((await getMyGroups(excludeFor)).map((g) => g.id));
    groups = groups.filter((g) => !mine.has(g.id));
  }
  return (await withCounts(groups)).sort((a, b) => b.members - a.members);
}

export async function joinGroup(groupId: string, playerId: string) {
  return db().from("group_members").upsert({ group_id: groupId, player_id: playerId }, { onConflict: "group_id,player_id", ignoreDuplicates: true });
}

export async function leaveGroup(groupId: string, playerId: string) {
  return db().from("group_members").delete().eq("group_id", groupId).eq("player_id", playerId);
}

export async function createGroup(input: { owner: string; name: string; emoji: string; color: string; is_public: boolean }): Promise<Group> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug((n) => randomBytes(n));
    const { data, error } = await db()
      .from("groups")
      .insert({ slug, name: input.name, emoji: input.emoji, color: input.color, is_public: input.is_public, owner_id: input.owner })
      .select("*")
      .single();
    if (!error) {
      await joinGroup(data.id, input.owner);
      return data;
    }
    if (error.code !== "23505") throw error; // אחרת — התנגשות slug, מנסים שוב
  }
  throw new Error("could not allocate slug");
}

export async function getMembers(groupId: string): Promise<{ id: string; name: string; joined_at: string }[]> {
  const { data: rows } = await db().from("group_members").select("player_id,joined_at").eq("group_id", groupId);
  const ids = (rows ?? []).map((r) => r.player_id);
  if (!ids.length) return [];
  const { data: players } = await db().from("players").select("id,name").in("id", ids);
  const nameBy = new Map((players ?? []).map((p) => [p.id, p.name]));
  return (rows ?? [])
    .map((r) => ({ id: r.player_id, name: nameBy.get(r.player_id) ?? "?", joined_at: r.joined_at }))
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
}

export async function getQuestions(groupId: string): Promise<GroupQuestion[]> {
  const { data } = await db().from("group_questions").select("id,position,text,answer").eq("group_id", groupId).order("position");
  return data ?? [];
}

/** תשובות חברי הקבוצה: player_id → (question_id → answer) */
export async function getAnswers(questionIds: string[]): Promise<Record<string, Record<string, boolean>>> {
  if (!questionIds.length) return {};
  const { data } = await db().from("group_answers").select("question_id,player_id,answer").in("question_id", questionIds);
  const out: Record<string, Record<string, boolean>> = {};
  for (const r of data ?? []) (out[r.player_id] ??= {})[r.question_id] = r.answer;
  return out;
}

export async function listAllGroups(): Promise<GroupWithCount[]> {
  const { data } = await db().from("groups").select("*").order("created_at");
  return withCounts(data ?? []);
}
