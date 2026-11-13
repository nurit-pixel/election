"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as lists from "@/lib/lists";
import { enqueue } from "@/lib/settings";

const id = (value: FormDataEntryValue | null) => Number(value);

/** הוספת מוצר לרשימה, או כחלופה לפריט קיים (כשנשלח item). */
export async function addProduct(formData: FormData) {
  const productId = id(formData.get("product"));
  const itemId = formData.get("item") ? id(formData.get("item")) : null;
  if (itemId) {
    await lists.addAlternative(itemId, productId);
  } else {
    await lists.addProductToList((await lists.getList()).id, productId);
  }
  // מוצר ברשימה שמורה נכנס למעקב: שומרים מיד את המחיר הנוכחי בהיסטוריה
  await enqueue("track");
  revalidatePath("/");
  redirect(itemId ? `/#item-${itemId}` : "/");
}

export async function changeQuantity(itemId: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) return;
  await lists.setQuantity(itemId, Math.round(quantity * 1000) / 1000);
  revalidatePath("/");
}

export async function removeItem(formData: FormData) {
  await lists.removeItem(id(formData.get("item")));
  revalidatePath("/");
}

export async function removeAlternative(formData: FormData) {
  await lists.removeAlternative(id(formData.get("item")), id(formData.get("product")));
  revalidatePath("/");
}

export async function renameItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name) await lists.renameItem(id(formData.get("item")), name);
  revalidatePath("/");
}

async function activate(listId: number) {
  (await cookies()).set(lists.LIST_COOKIE, String(listId), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export async function switchList(formData: FormData) {
  await activate(id(formData.get("list")));
  revalidatePath("/");
}

export async function createList(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) return;
  await activate(await lists.createList(name));
  revalidatePath("/");
}

export async function renameList(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (name) await lists.renameList(id(formData.get("list")), name);
  revalidatePath("/");
}

export async function deleteList(formData: FormData) {
  await lists.deleteList(id(formData.get("list")));
  revalidatePath("/");
}
