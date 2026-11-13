import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./auth";

/** מזהה המשתמש המחובר, או null. נבדק פעם אחת לכל בקשה. */
export const currentUserId = cache(async (): Promise<number | null> => {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
});

/** מזהה המשתמש המחובר; בלי סשן תקין עוברים למסך הכניסה. */
export async function uid(): Promise<number> {
  const id = await currentUserId();
  if (id == null) redirect("/login");
  return id;
}
