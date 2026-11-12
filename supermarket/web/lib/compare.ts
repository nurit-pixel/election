import "server-only";
import { pool } from "./db";
import { priceBasket, rankStores, type BasketItem, type StoreBasket, type StorePrice } from "./basket";
import type { Promo } from "./promos";
import { getList, type ShoppingList } from "./lists";

const STALE_HOURS = Number(process.env.STALE_PRICE_HOURS ?? 36);

export type StoreInfo = {
  storePk: number;
  chainKey: string;
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
  /** לסניף נטען קובץ מבצעים */
  hasPromos: boolean;
};

export type RankedStore = StoreInfo & { basket: StoreBasket };

const STORE_COLUMNS = `
  s.id AS store_pk, s.chain_key, c.name AS chain_name, c.is_pharm,
  COALESCE(s.name, 'סניף ' || s.store_id) AS name, s.address, s.city,
  s.geocode_precision = 'city' AS approximate, s.prices_file_time,
  s.promos_file_time IS NOT NULL AS has_promos`;

function toStore(r: Record<string, unknown>): StoreInfo {
  return {
    storePk: r.store_pk as number,
    chainKey: r.chain_key as string,
    chainName: r.chain_name as string,
    isPharm: r.is_pharm as boolean,
    name: r.name as string,
    address: (r.address as string) ?? null,
    city: (r.city as string) ?? null,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    nearestAddress: (r.nearest_address as string) ?? null,
    approximate: r.approximate === true,
    pricesFileTime: (r.prices_file_time as string) ?? null,
    hasPromos: r.has_promos === true,
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

const iso = (value: unknown) => (value == null ? null : new Date(value as string).toISOString());
const num = (value: unknown) => (value == null ? null : Number(value));

/** מחירים ומבצעים בתוקף, לפי סניף ומוצר. */
async function pricesByStore(storePks: number[], productIds: number[]) {
  const byStore = new Map<number, Map<number, StorePrice>>();
  if (storePks.length === 0 || productIds.length === 0) return byStore;
  const [prices, promos] = await Promise.all([
    pool.query(
      `SELECT pr.store_pk, pr.product_id, pr.price, pr.file_time, p.name
       FROM prices pr JOIN products p ON p.id = pr.product_id
       WHERE pr.store_pk = ANY($1) AND pr.product_id = ANY($2)`,
      [storePks, productIds],
    ),
    pool.query(
      `SELECT pi.store_pk, pi.product_id, pm.id, pm.description, pm.start_at, pm.end_at,
              pi.min_qty, pi.max_qty, pi.discounted_price, pm.nth_n, pm.nth_rate,
              pm.club_ids, pm.club_text, pm.min_purchase, pm.restricted
       FROM promotion_items pi JOIN promotions pm ON pm.id = pi.promotion_pk
       WHERE pi.store_pk = ANY($1) AND pi.product_id = ANY($2)
         AND (pm.start_at IS NULL OR pm.start_at <= now())
         AND (pm.end_at IS NULL OR pm.end_at >= now())`,
      [storePks, productIds],
    ),
  ]);
  for (const r of prices.rows) {
    if (!byStore.has(r.store_pk)) byStore.set(r.store_pk, new Map());
    byStore.get(r.store_pk)!.set(r.product_id, {
      productId: r.product_id,
      productName: r.name,
      price: Number(r.price),
      fileTime: new Date(r.file_time).toISOString(),
      promos: [],
    });
  }
  for (const r of promos.rows) {
    const price = byStore.get(r.store_pk)?.get(r.product_id);
    if (!price) continue;
    const promo: Promo = {
      id: Number(r.id),
      description: r.description ?? "מבצע",
      startAt: iso(r.start_at),
      endAt: iso(r.end_at),
      minQty: num(r.min_qty) ?? 1,
      maxQty: num(r.max_qty),
      discountedPrice: num(r.discounted_price),
      nthN: r.nth_n,
      nthRate: num(r.nth_rate),
      clubIds: r.club_ids ?? [],
      clubName: r.club_text,
      minPurchase: num(r.min_purchase),
      restricted: r.restricted,
    };
    price.promos!.push(promo);
  }
  return byStore;
}

/** המועדונים שסומנו בהגדרות, לפי רשת. */
async function memberClubs(): Promise<Map<string, number[]>> {
  const { rows } = await pool.query(`SELECT chain_key, club_id FROM clubs WHERE member`);
  const byChain = new Map<string, number[]>();
  for (const r of rows) byChain.set(r.chain_key, [...(byChain.get(r.chain_key) ?? []), r.club_id]);
  return byChain;
}

/** דירוג כל הסניפים שברדיוס לפי מחיר הסל של הרשימה. */
export async function compareStores(): Promise<{ list: ShoppingList; ranked: RankedStore[]; storesInRadius: number }> {
  const [list, stores, clubs] = await Promise.all([getList(), storesInRadius(), memberClubs()]);
  const items = basketItems(list);
  const prices = await pricesByStore(
    stores.map((s) => s.storePk),
    items.flatMap((i) => i.productIds),
  );
  const now = new Date();
  const ranked = rankStores(
    stores.map((s) => ({
      ...s,
      basket: priceBasket(items, prices.get(s.storePk) ?? new Map(), now, {
        staleHours: STALE_HOURS,
        memberClubIds: clubs.get(s.chainKey),
      }),
    })),
  );
  return { list, ranked, storesInRadius: stores.length };
}

/** הסל של הרשימה בסניף אחד. */
export async function storeBasket(storePk: number): Promise<RankedStore | null> {
  const [list, storeRows, clubs] = await Promise.all([
    getList(),
    pool.query(
      `SELECT ${STORE_COLUMNS},
              (SELECT min(distance_km(a.lat, a.lng, s.lat, s.lng)) FROM addresses a
                WHERE a.lat IS NOT NULL AND s.lat IS NOT NULL) AS distance_km,
              NULL AS nearest_address
       FROM stores s JOIN chains c ON c.key = s.chain_key WHERE s.id = $1`,
      [storePk],
    ),
    memberClubs(),
  ]);
  if (storeRows.rows.length === 0) return null;
  const store = toStore(storeRows.rows[0]);
  const items = basketItems(list);
  const prices = await pricesByStore([storePk], items.flatMap((i) => i.productIds));
  return {
    ...store,
    basket: priceBasket(items, prices.get(storePk) ?? new Map(), new Date(), {
      staleHours: STALE_HOURS,
      memberClubIds: clubs.get(store.chainKey),
    }),
  };
}
