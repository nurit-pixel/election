"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { pool } from "@/lib/db";

/** מחיקת חוות דעת לא ראויה. מנהל בלבד. */
export async function deleteReview(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = Number(formData.get("review"));
  if (!Number.isInteger(id)) return;
  await pool.query(`DELETE FROM store_reviews WHERE id = $1`, [id]);
  revalidatePath("/admin");
}
