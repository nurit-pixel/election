"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as lists from "@/lib/lists";

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
