"use server";

import { revalidatePath } from "next/cache";
import { deleteMyReview, saveReview } from "@/lib/reviews";

export async function submitReview(formData: FormData) {
  const storePk = Number(formData.get("store"));
  if (!Number.isInteger(storePk)) return;
  await saveReview(storePk, Number(formData.get("rating")), String(formData.get("comment") ?? ""));
  revalidatePath(`/store/${storePk}`);
  revalidatePath("/compare");
}

export async function removeReview(formData: FormData) {
  const storePk = Number(formData.get("store"));
  if (!Number.isInteger(storePk)) return;
  await deleteMyReview(storePk);
  revalidatePath(`/store/${storePk}`);
  revalidatePath("/compare");
}
