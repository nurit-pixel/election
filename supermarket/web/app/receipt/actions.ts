"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as lists from "@/lib/lists";
import { enqueue } from "@/lib/settings";

/** הוספת המוצרים שאושרו במסך האישור לרשימה הפעילה. */
export async function addReceiptItems(items: { productId: number; quantity: number }[]) {
  const valid = items
    .filter((i) => Number.isInteger(i.productId) && Number.isFinite(i.quantity) && i.quantity > 0 && i.quantity <= 999)
    .slice(0, 150);
  if (valid.length > 0) {
    const listId = (await lists.getList()).id;
    for (const item of valid) {
      await lists.addProductToList(listId, item.productId, Math.round(item.quantity * 1000) / 1000);
    }
    await enqueue("track");
    revalidatePath("/");
  }
  redirect("/");
}
