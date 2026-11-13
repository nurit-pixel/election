"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as lists from "@/lib/lists";
import { enqueue } from "@/lib/settings";

/** הוספת המוצרים שאושרו במסך האישור לרשימה הפעילה. כל מוצר נכנס בכמות 1;
 * מוצר שכבר ברשימה נשאר כמו שהוא. */
export async function addReceiptItems(productIds: number[]) {
  const valid = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 150);
  if (valid.length > 0) {
    const listId = (await lists.getList()).id;
    for (const productId of valid) await lists.addProductToList(listId, productId, 1, false);
    await enqueue("track");
    revalidatePath("/");
  }
  redirect("/");
}
