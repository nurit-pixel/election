import "server-only";
import { cookies } from "next/headers";
import { pool } from "./db";
import { uid } from "./session";

/** תנאי SQL: הרשימה (בכינוי l) שייכת למשתמש, או שותפה איתו */
const CAN_ACCESS = (user: number) =>
  `(l.user_id = ${user} OR EXISTS (SELECT 1 FROM list_members m WHERE m.list_id = l.id AND m.user_id = ${user}))`;

/** תנאי SQL: הפריט ברשימה שהמשתמש רשאי לערוך (שלו או משותפת איתו) */
const OWN_ITEM = (user: number) => `list_id IN (SELECT l.id FROM lists l WHERE ${CAN_ACCESS(user)})`;

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

export type ListSummary = {
  id: number;
  name: string;
  itemCount: number;
  /** הרשימה של המשתמש עצמו (ולא רשימה ששותפה איתו) */
  isOwner: boolean;
  /** שם בעל הרשימה, כשהיא משותפת עם המשתמש */
  ownerName: string | null;
  /** מספר המשתתפים מלבד הבעלים */
  members: number;
};

/** כל הרשימות של המשתמש, וגם רשימות ששותפו איתו. */
export async function listSummaries(): Promise<ListSummary[]> {
  const user = await uid();
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.user_id = $1 AS is_owner, o.name AS owner_name, o.email AS owner_email,
            (SELECT count(*) FROM list_items i WHERE i.list_id = l.id) AS item_count,
            (SELECT count(*) FROM list_members m WHERE m.list_id = l.id) AS members
     FROM lists l LEFT JOIN users o ON o.id = l.user_id
     WHERE ${CAN_ACCESS(user)}
     ORDER BY (l.user_id = $1) DESC, l.id`,
    [user],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    itemCount: Number(r.item_count),
    isOwner: r.is_owner,
    ownerName: r.is_owner ? null : r.owner_name || r.owner_email || "משתמש/ת אחר/ת",
    members: Number(r.members),
  }));
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
    `SELECT l.id, l.name FROM lists l WHERE ${CAN_ACCESS(user)}
     ORDER BY (l.id = $1) DESC, (l.user_id = $2) DESC, l.id LIMIT 1`,
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
  const user = await uid();
  const owned = await pool.query(`SELECT 1 FROM lists l WHERE l.id = $1 AND ${CAN_ACCESS(user)}`, [listId]);
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

// ---------- שיתוף ----------

export type ListPeople = {
  owner: { name: string | null; email: string; isMe: boolean };
  members: { userId: number; name: string | null; email: string; isMe: boolean }[];
  /** הזמנות למיילים שעוד לא נכנסו לאפליקציה */
  invites: string[];
  isOwner: boolean;
};

/** מי משתתף ברשימה. null אם המשתמש לא רשאי לראות אותה. */
export async function listPeople(listId: number): Promise<ListPeople | null> {
  const user = await uid();
  const owner = await pool.query(
    `SELECT u.id, u.name, u.email FROM lists l JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND ${CAN_ACCESS(user)}`,
    [listId],
  );
  if (owner.rows.length === 0) return null;
  const [members, invites] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.email FROM list_members m JOIN users u ON u.id = m.user_id
       WHERE m.list_id = $1 ORDER BY m.added_at`,
      [listId],
    ),
    pool.query(`SELECT email FROM list_invites WHERE list_id = $1 ORDER BY created_at`, [listId]),
  ]);
  const o = owner.rows[0];
  return {
    owner: { name: o.name, email: o.email, isMe: o.id === user },
    members: members.rows.map((m) => ({ userId: m.id, name: m.name, email: m.email, isMe: m.id === user })),
    invites: invites.rows.map((i) => i.email),
    isOwner: o.id === user,
  };
}

export type ShareResult = "added" | "invited" | "self" | "already" | "invalid" | "forbidden";

/** שיתוף הרשימה עם מייל: משתמש קיים מצטרף מיד; מייל אחר מקבל הזמנה שתופעל בכניסה הראשונה שלו. */
export async function shareList(listId: number, rawEmail: string): Promise<ShareResult> {
  const user = await uid();
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return "invalid";
  const owned = await pool.query(`SELECT 1 FROM lists WHERE id = $1 AND user_id = $2`, [listId, user]);
  if (owned.rows.length === 0) return "forbidden";
  const target = await pool.query(`SELECT id FROM users WHERE lower(email) = $1 ORDER BY id LIMIT 1`, [email]);
  if (target.rows.length > 0) {
    if (target.rows[0].id === user) return "self";
    const { rowCount } = await pool.query(
      `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [listId, target.rows[0].id],
    );
    return rowCount ? "added" : "already";
  }
  const { rowCount } = await pool.query(
    `INSERT INTO list_invites (list_id, email, invited_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [listId, email, user],
  );
  return rowCount ? "invited" : "already";
}

/** הסרת משתתף או הזמנה (בעל הרשימה בלבד). */
export async function removeFromList(listId: number, target: { userId?: number; email?: string }): Promise<void> {
  const user = await uid();
  const owned = await pool.query(`SELECT 1 FROM lists WHERE id = $1 AND user_id = $2`, [listId, user]);
  if (owned.rows.length === 0) return;
  if (target.userId) await pool.query(`DELETE FROM list_members WHERE list_id = $1 AND user_id = $2`, [listId, target.userId]);
  if (target.email) await pool.query(`DELETE FROM list_invites WHERE list_id = $1 AND lower(email) = lower($2)`, [listId, target.email]);
}

/** יציאה מרשימה ששותפה עם המשתמש. */
export async function leaveList(listId: number): Promise<void> {
  await pool.query(`DELETE FROM list_members WHERE list_id = $1 AND user_id = $2`, [listId, await uid()]);
}
