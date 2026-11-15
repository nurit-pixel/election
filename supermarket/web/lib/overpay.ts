import "server-only";
import { pricesByStore, storesInRadius } from "./compare";
import { overpay, type Overpay, type PaidItem } from "./overpay-calc";

/** ההשוואה לחשבונית מול הסניפים שברדיוס של המשתמש, לפי מחיר המדף. */
export async function receiptOverpay(items: PaidItem[]): Promise<Overpay | null> {
  const clean = items.filter((i) => Number.isInteger(i.productId) && Number.isFinite(i.paid) && i.paid > 0 && i.paid < 5000).slice(0, 150);
  if (clean.length < 2) return null;
  const stores = (await storesInRadius()).filter((s) => !s.isPharm);
  const prices = await pricesByStore(
    stores.map((s) => s.storePk),
    clean.map((i) => i.productId),
  );
  return overpay(
    clean,
    stores.map((s) => ({
      storePk: s.storePk,
      label: `${s.chainName} · ${s.name}`,
      prices: new Map([...(prices.get(s.storePk) ?? new Map()).values()].map((p) => [p.productId, p.price])),
    })),
  );
}
