"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { A11Y_COOKIE, isDefaultA11y, serializeA11y, type A11yPrefs } from "@/lib/a11y";

export async function saveA11y(formData: FormData) {
  const text = String(formData.get("text"));
  const prefs: A11yPrefs = {
    text: text === "large" || text === "xlarge" ? text : "normal",
    contrast: formData.get("contrast") === "on",
    links: formData.get("links") === "on",
    still: formData.get("still") === "on",
    readable: formData.get("readable") === "on",
  };
  const store = await cookies();
  if (isDefaultA11y(prefs)) store.delete(A11Y_COOKIE);
  else store.set(A11Y_COOKIE, serializeA11y(prefs), { sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  revalidatePath("/", "layout");
  redirect("/accessibility?saved=1");
}

export async function resetA11y() {
  (await cookies()).delete(A11Y_COOKIE);
  revalidatePath("/", "layout");
  redirect("/accessibility?saved=1");
}
