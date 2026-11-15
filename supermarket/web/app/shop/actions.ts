"use server";

import { revalidatePath } from "next/cache";
import * as lists from "@/lib/lists";

export async function toggleItem(itemId: number, checked: boolean) {
  if (!Number.isInteger(itemId)) return;
  await lists.setChecked(itemId, checked);
  revalidatePath("/shop");
}

export async function finishShopping(formData: FormData) {
  await lists.clearChecked(Number(formData.get("list")));
  revalidatePath("/shop");
  revalidatePath("/");
}
