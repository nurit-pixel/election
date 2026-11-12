import "server-only";
import { pool } from "./db";
import { priceBasket, rankStores, type BasketItem, type StoreBasket, type StorePrice } from "./basket";
import { getList, type ShoppingList } from "./lists";

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

export type StoreInfo = {
  storePk: number;
  chainName: string;
  isPharm: boolean;
  name: string;
  address: string | null;
  city: string | null;
  /** מרחק בק"מ מהכתובת השמורה הקרובה */
  distanceKm: number | null;
  nearestAddress: string | null;
  /** הסניף מוקם רק לפי העיר */
  approximate: boolean;
  pricesFileTime: string | null;
};

export type RankedStore = StoreInfo & { basket: StoreBasket };

const STORE_COLUMNS = `
  s.id AS store_pk, c.name AS chain_name, c.is_pharm,
  COALESCE(s.name, 'סניף ' || s.store_id) AS name, s.address, s.city,
  s.geocode_precision = 'city' AS approximate, s.prices_file_time`;

function toStore(r: Record<string, unknown>): StoreInfo {
  return {
    storePk: r.store_pk as number,
    chainName: r.chain_name as string,
    isPharm: r.is_pharm as boolean,
    name: r.name as string,
    address: (r.address as string) ?? null,
    city: (r.city as string) ?? null,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    nearestAddress: (r.nearest_address as string) ?? null,
    approximate: r.approximate === true,
    pricesFileTime: (r.prices_file_time as string) ?? null,
  };
}

/** סניפים עם מחירים שנמצאים ברדיוס של כתובת שמורה, עם המרחק מהכתובת הקרובה. */
export async function storesInRadius(): Promise<StoreInfo[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (s.id) ${STORE_COLUMNS},
            distance_km(a.lat, a.lng, s.lat, s.lng) AS distance_km, a.label AS nearest_address
     FROM stores s
     JOIN chains c ON c.key = s.chain_key AND NOT c.hidden
     JOIN addresses a ON a.lat IS NOT NULL AND s.lat IS NOT NULL
      AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km
     WHERE s.prices_file_time IS NOT NULL
     ORDER BY s.id, distance_km`,
  );
  return rows.map(toStore);
}

function basketItems(list: ShoppingList): BasketItem[] {
  return list.items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    isWeighted: i.isWeighted,
    productIds: i.products.map((p) => p.id),
  }));
}

async function pricesByStore(storePks: number[], productIds: number[]) {
  const byStore = new Map<number, Map<number, StorePrice>>();
  if (storePks.length === 0 || productIds.length === 0) return byStore;
  const { rows } = await pool.query(
    `SELECT pr.store_pk, pr.product_id, pr.price, pr.file_time, p.name
     FROM prices pr JOIN products p ON p.id = pr.product_id
     WHERE pr.store_pk = ANY($1) AND pr.product_id = ANY($2)`,
    [storePks, productIds],
  );
  for (const r of rows) {
    if (!byStore.has(r.store_pk)) byStore.set(r.store_pk, new Map());
    byStore.get(r.store_pk)!.set(r.product_id, {
      productId: r.product_id,
      productName: r.name,
      price: Number(r.price),
      fileTime: new Date(r.file_time).toISOString(),
    });
  }
  return byStore;
}

/** דירוג כל הסניפים שברדיוס לפי מחיר הסל של הרשימה. */
export async function compareStores(): Promise<{ list: ShoppingList; ranked: RankedStore[]; storesInRadius: number }> {
  const [list, stores] = await Promise.all([getList(), storesInRadius()]);
  const items = basketItems(list);
  const prices = await pricesByStore(
    stores.map((s) => s.storePk),
    items.flatMap((i) => i.productIds),
  );
  const now = new Date();
  const ranked = rankStores(
    stores.map((s) => ({
      ...s,
      basket: priceBasket(items, prices.get(s.storePk) ?? new Map(), now, STALE_HOURS),
    })),
  );
  return { list, ranked, storesInRadius: stores.length };
}

/** הסל של הרשימה בסניף אחד. */
export async function storeBasket(storePk: number): Promise<RankedStore | null> {
  const [list, storeRows] = await Promise.all([
    getList(),
    pool.query(
      `SELECT ${STORE_COLUMNS},
              (SELECT min(distance_km(a.lat, a.lng, s.lat, s.lng)) FROM addresses a
                WHERE a.lat IS NOT NULL AND s.lat IS NOT NULL) AS distance_km,
              NULL AS nearest_address
       FROM stores s JOIN chains c ON c.key = s.chain_key WHERE s.id = $1`,
      [storePk],
    ),
  ]);
  if (storeRows.rows.length === 0) return null;
  const items = basketItems(list);
  const prices = await pricesByStore([storePk], items.flatMap((i) => i.productIds));
  return {
    ...toStore(storeRows.rows[0]),
    basket: priceBasket(items, prices.get(storePk) ?? new Map(), new Date(), STALE_HOURS),
  };
}
