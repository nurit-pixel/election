"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { enqueue, setChainHidden, setSplitMinSaving } from "@/lib/settings";

const DEFAULT_RADIUS = Number(process.env.DEFAULT_RADIUS_KM ?? 5);

export async function addAddress(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  const address = String(formData.get("address") ?? "").trim().slice(0, 200);
  const radius = Math.min(50, Math.max(0.5, Number(formData.get("radius")) || DEFAULT_RADIUS));
  if (!address) return;
  const { rows } = await pool.query(
    `INSERT INTO addresses (label, address, radius_km) VALUES ($1, $2, $3) RETURNING id`,
    [label || address, address, radius],
  );
  // טעינה מיידית של הסניפים שליד הכתובת החדשה
  await enqueue("address", rows[0].id);
  revalidatePath("/settings");
}

export async function deleteAddress(formData: FormData) {
  await pool.query(`DELETE FROM addresses WHERE id = $1`, [Number(formData.get("id"))]);
  revalidatePath("/settings");
}

export async function updateRadius(formData: FormData) {
  const id = Number(formData.get("id"));
  const radius = Math.min(50, Math.max(0.5, Number(formData.get("radius")) || DEFAULT_RADIUS));
  await pool.query(`UPDATE addresses SET radius_km = $2 WHERE id = $1`, [id, radius]);
  await enqueue("address", id);
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
  await pool.query(`UPDATE clubs SET member = $3 WHERE chain_key = $1 AND club_id = $2`, [
    String(formData.get("chain")),
    Number(formData.get("club")),
    formData.get("member") === "1",
  ]);
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
