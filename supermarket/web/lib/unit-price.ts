/** מחיר ליחידת מידה (לק״ג, לליטר, ל-100 גרם, ליחידה) מתוך הכמות באריזה ויחידת המידה שהרשת מפרסמת. לוגיקה טהורה. */

export type UnitPrice = { value: number; label: string };

type Kind = { base: "g" | "ml" | "unit"; factor: number };

/** יחידות המידה כפי שהן מופיעות בקבצים, מנורמלות לגרם, מ״ל או יחידה */
function kindOf(unit: string | null): Kind | null {
  const u = (unit ?? "").trim().replace(/["'״׳.]/g, "");
  if (/^(גרם|גרמים|גר|ג)$/.test(u)) return { base: "g", factor: 1 };
  if (/^(100 גרם|100 גר)$/.test(u)) return { base: "g", factor: 100 };
  if (/^(קילוגרם|קילוגרמים|קג|קילו)$/.test(u)) return { base: "g", factor: 1000 };
  if (/^(מיליליטר|מיליליטרים|מל)$/.test(u)) return { base: "ml", factor: 1 };
  if (/^(100 מל)$/.test(u)) return { base: "ml", factor: 100 };
  if (/^(ליטר|ליטרים|ל)$/.test(u)) return { base: "ml", factor: 1000 };
  if (/^(יחידה|יחידות|יח)$/.test(u)) return { base: "unit", factor: 1 };
  return null;
}

/** הכמות באריזה בגרם / מ״ל / יחידות, או null כשלא ידוע */
export function packSize(quantity: number | null, unit: string | null): { base: Kind["base"]; amount: number } | null {
  const kind = kindOf(unit);
  if (!kind || !quantity || quantity <= 0) return null;
  return { base: kind.base, amount: quantity * kind.factor };
}

/** מספר היחידות באריזה מתוך השם ("12 יח", "6*1.5"), או null */
export function packCount(name: string): number | null {
  const m = name.match(/(\d+)\s*(?:יח|יחידות)/) ?? name.match(/(\d+)\s*[*xX×]\s*\d/);
  return m ? Number(m[1]) : null;
}

/** הגודל בפועל: כשהרשת רושמת "1 יחידות" והמספר האמיתי רק בשם (ביצים 12 יח), לוקחים אותו מהשם */
export function effectiveSize(
  quantity: number | null,
  unit: string | null,
  name = "",
): { base: Kind["base"]; amount: number } | null {
  const size = packSize(quantity, unit);
  if (size?.base === "unit" && size.amount <= 1) {
    const count = packCount(name);
    if (count && count > 1) return { base: "unit", amount: count };
  }
  return size;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** מחיר לק״ג או לליטר; לאריזה קטנה מ-100 גרם/מ״ל, ל-100 גרם/מ״ל (אחרת המספר מטעה); ליחידה כשיש יותר מיחידה אחת.
 * מוצר שקיל כבר מתומחר לק״ג, ולכן אין לו מחיר נוסף. */
export function unitPrice(
  price: number,
  quantity: number | null,
  unit: string | null,
  isWeighted = false,
  name = "",
): UnitPrice | null {
  if (isWeighted || !(price > 0)) return null;
  const size = effectiveSize(quantity, unit, name);
  if (!size) return null;
  if (size.base === "unit") return size.amount > 1 ? { value: round(price / size.amount), label: "ליחידה" } : null;
  const measure = size.base === "g" ? "גרם" : "מ״ל";
  if (size.amount < 100) return { value: round((price / size.amount) * 100), label: `ל-100 ${measure}` };
  return { value: round((price / size.amount) * 1000), label: size.base === "g" ? "לק״ג" : "לליטר" };
}
