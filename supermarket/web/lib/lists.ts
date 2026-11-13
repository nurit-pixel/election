import "server-only";
import { cookies } from "next/headers";
import { pool } from "./db";
import { uid } from "./session";

/** תנאי SQL: הפריט שייך לרשימה של המשתמש */
const OWN_ITEM = (user: number) => `list_id IN (SELECT id FROM lists WHERE user_id = ${user})`;

export const LIST_COOKIE = "active_list";

export type ListProduct = {
  id: number;
  barcode: string;
  name: string;
  manufacturer: string | null;
  /** קוד פנימי של רשת: קיים רק ברשת אחת */
  chainName: string | null;
};

export type ListItem = {
  id: number;
  name: string;
  quantity: number;
  isWeighted: boolean;
  products: ListProduct[];
};

export type ShoppingList = { id: number; name: string; items: ListItem[] };

export type ListSummary = { id: number; name: string; itemCount: number };

/** כל הרשימות השמורות. */
export async function listSummaries(): Promise<ListSummary[]> {
  const { rows } = await pool.query(
    `SELECT l.id, l.name, count(i.id) AS item_count
     FROM lists l LEFT JOIN list_items i ON i.list_id = l.id
     WHERE l.user_id = $1
     GROUP BY l.id ORDER BY l.id`,
    [await uid()],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, itemCount: Number(r.item_count) }));
}

export async function createList(name: string): Promise<number> {
  const { rows } = await pool.query(`INSERT INTO lists (name, user_id) VALUES ($1, $2) RETURNING id`, [name, await uid()]);
  return rows[0].id;
}

export async function renameList(listId: number, name: string): Promise<void> {
  await pool.query(`UPDATE lists SET name = $2 WHERE id = $1 AND user_id = $3`, [listId, name, await uid()]);
}

export async function deleteList(listId: number): Promise<void> {
  await pool.query(`DELETE FROM lists WHERE id = $1 AND user_id = $2`, [listId, await uid()]);
}

/** הרשימה הפעילה (לפי העוגייה; אחרת הראשונה). נוצרת בכניסה הראשונה. */
export async function getList(): Promise<ShoppingList> {
  const wanted = Number((await cookies()).get(LIST_COOKIE)?.value);
  const user = await uid();
  let { rows } = await pool.query(
    `SELECT id, name FROM lists WHERE user_id = $2 ORDER BY (id = $1) DESC, id LIMIT 1`,
    [Number.isInteger(wanted) ? wanted : 0, user],
  );
  if (rows.length === 0) {
    ({ rows } = await pool.query(
      `INSERT INTO lists (name, user_id) VALUES ('הרשימה שלי', $1) RETURNING id, name`,
      [user],
    ));
  }
  const list = rows[0];
  const items = await pool.query(
    `SELECT i.id, i.name, i.quantity, i.is_weighted,
            COALESCE(json_agg(json_build_object(
              'id', p.id, 'barcode', p.barcode, 'name', p.name, 'manufacturer', p.manufacturer,
              'chainName', c.name) ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '[]') AS products
     FROM list_items i
     LEFT JOIN list_item_products ip ON ip.item_id = i.id
     LEFT JOIN products p ON p.id = ip.product_id
     LEFT JOIN chains c ON c.key = p.internal_chain
     WHERE i.list_id = $1
     GROUP BY i.id ORDER BY i.id`,
    [list.id],
  );
  return {
    id: list.id,
    name: list.name,
    items: items.rows.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: Number(r.quantity),
      isWeighted: r.is_weighted,
      products: r.products,
    })),
  };
}

export async function getItem(itemId: number): Promise<ListItem | null> {
  return (await getList()).items.find((i) => i.id === itemId) ?? null;
}

/** פריט חדש ברשימה מתוך מוצר, בכמות נתונה. */
export async function addProductToList(
  listId: number,
  productId: number,
  quantity = 1,
  /** מוצר שכבר ברשימה: להגדיל את הכמות (ברירת מחדל), או להשאיר כמו שהוא */
  increaseExisting = true,
): Promise<void> {
  const owned = await pool.query(`SELECT 1 FROM lists WHERE id = $1 AND user_id = $2`, [listId, await uid()]);
  if (owned.rows.length === 0) return;
  const existing = await pool.query(
    `SELECT i.id FROM list_items i JOIN list_item_products ip ON ip.item_id = i.id
     WHERE i.list_id = $1 AND ip.product_id = $2 LIMIT 1`,
    [listId, productId],
  );
  if (existing.rows.length > 0) {
    if (!increaseExisting) return;
    await pool.query(`UPDATE list_items SET quantity = quantity + $2 WHERE id = $1`, [existing.rows[0].id, quantity]);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO list_items (list_id, name, is_weighted, quantity)
       SELECT $1, name, is_weighted, $3 FROM products WHERE id = $2 RETURNING id`,
      [listId, productId, quantity],
    );
    if (rows.length > 0) {
      await client.query(`INSERT INTO list_item_products (item_id, product_id) VALUES ($1, $2)`, [
        rows[0].id,
        productId,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** הוספת חלופה לפריט. חלופה חייבת להיות מאותו סוג (שקיל / לא שקיל) כמו הפריט. */
export async function addAlternative(itemId: number, productId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO list_item_products (item_id, product_id)
     SELECT i.id, p.id FROM list_items i, products p
     WHERE i.id = $1 AND p.id = $2 AND p.is_weighted = i.is_weighted AND i.${OWN_ITEM(await uid())}
     ON CONFLICT DO NOTHING`,
    [itemId, productId],
  );
  return (rowCount ?? 0) > 0;
}

export async function removeAlternative(itemId: number, productId: number): Promise<void> {
  const own = OWN_ITEM(await uid());
  await pool.query(
    `DELETE FROM list_item_products WHERE item_id = $1 AND product_id = $2
       AND item_id IN (SELECT id FROM list_items WHERE ${own})`,
    [itemId, productId],
  );
  // פריט בלי אף מוצר נמחק
  await pool.query(
    `DELETE FROM list_items i WHERE i.id = $1 AND i.${own}
       AND NOT EXISTS (SELECT 1 FROM list_item_products ip WHERE ip.item_id = i.id)`,
    [itemId],
  );
}

export async function removeItem(itemId: number): Promise<void> {
  await pool.query(`DELETE FROM list_items WHERE id = $1 AND ${OWN_ITEM(await uid())}`, [itemId]);
}

export async function setQuantity(itemId: number, quantity: number): Promise<void> {
  await pool.query(`UPDATE list_items SET quantity = $2 WHERE id = $1 AND ${OWN_ITEM(await uid())}`, [itemId, quantity]);
}

export async function renameItem(itemId: number, name: string): Promise<void> {
  await pool.query(`UPDATE list_items SET name = $2 WHERE id = $1 AND ${OWN_ITEM(await uid())}`, [itemId, name]);
}
