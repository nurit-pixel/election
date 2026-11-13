"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE } from "@/lib/theme";
import { locateAddress } from "@/lib/geocode";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  addUserAddress,
  deleteUserAddress,
  enqueue,
  setAddressRadius,
  setChainHidden,
  setClubMember,
  setSplitMinSaving,
  updateUserAddress,
} from "@/lib/settings";

const DEFAULT_RADIUS = Number(process.env.DEFAULT_RADIUS_KM ?? 5);

/** חזרה למסך ההגדרות עם הודעת "לא נמצאה" והטקסט שהוקלד, כדי שאפשר יהיה לתקן אותו */
function addressNotFound(target: string, address: string, label = ""): never {
  const params = new URLSearchParams({ notfound: target, address, label });
  redirect(`/settings?${params}#addresses`);
}

export async function addAddress(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  const address = String(formData.get("address") ?? "").trim().slice(0, 200);
  const radius = Math.min(50, Math.max(0.5, Number(formData.get("radius")) || DEFAULT_RADIUS));
  if (!address) return;
  // מאתרים את הכתובת לפני השמירה: כתובת שלא נמצאה לא נשמרת, והמשתמש מתקן אותה במקום
  const location = await locateAddress(address);
  if (location.status === "notfound") addressNotFound("new", address, label);
  const id = await addUserAddress(label || address, address, radius, location.status === "found" ? location : null);
  // ה-worker משלים ברקע מחירים לסניפים שעוד לא נטענו (ומאתר את הכתובת, אם שירות האיתור לא ענה)
  if (id != null) await enqueue("address", id);
  revalidatePath("/settings");
  redirect("/settings#addresses");
}

/** תיקון כתובת שמורה (שגיאת הקלדה, או מקום שזוהה לא נכון). */
export async function fixAddress(formData: FormData) {
  const id = Number(formData.get("id"));
  const address = String(formData.get("address") ?? "").trim().slice(0, 200);
  if (!address) return;
  const location = await locateAddress(address);
  if (location.status !== "found") addressNotFound(String(id), address);
  if (await updateUserAddress(id, address, location)) await enqueue("address", id);
  revalidatePath("/settings");
  redirect("/settings#addresses");
}

export async function deleteAddress(formData: FormData) {
  await deleteUserAddress(Number(formData.get("id")));
  revalidatePath("/settings");
}

export async function updateRadius(formData: FormData) {
  const id = Number(formData.get("id"));
  const radius = Math.min(50, Math.max(0.5, Number(formData.get("radius")) || DEFAULT_RADIUS));
  if (await setAddressRadius(id, radius)) await enqueue("address", id);
  revalidatePath("/settings");
}

export async function requestStores() {
  await enqueue("stores");
  revalidatePath("/settings");
}

export async function requestPrices() {
  await enqueue("prices");
  revalidatePath("/settings");
}

export async function setClub(formData: FormData) {
  await setClubMember(String(formData.get("chain")), Number(formData.get("club")), formData.get("member") === "1");
  revalidatePath("/settings");
}

export async function updateSplitThreshold(formData: FormData) {
  const value = Number(formData.get("threshold"));
  if (Number.isFinite(value) && value >= 0 && value <= 1000) await setSplitMinSaving(value);
  revalidatePath("/settings");
}

export async function toggleChain(formData: FormData) {
  await setChainHidden(String(formData.get("chain")), formData.get("hidden") === "1");
  revalidatePath("/settings");
}

export async function setTheme(formData: FormData) {
  const theme = String(formData.get("theme"));
  const store = await cookies();
  if (theme === "light" || theme === "dark") {
    store.set(THEME_COOKIE, theme, { sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  } else {
    store.delete(THEME_COOKIE);
  }
  revalidatePath("/", "layout");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
