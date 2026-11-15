"use client";

import { useEffect, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleItem } from "@/app/shop/actions";
import { formatQuantity } from "@/lib/format";
import { Price } from "./ui";

export type ShopItem = {
  id: number;
  name: string;
  quantity: number;
  isWeighted: boolean;
  checked: boolean;
  /** המחיר בסניף שנבחר, אם נבחר סניף */
  price: number | null;
  /** המותג שבפריט לא נמכר בסניף: מה לקנות במקומו */
  substitute: string | null;
};

/** רשימת קנייה: לחיצה על פריט מסמנת אותו כ"בעגלה". פריטים שסומנו יורדים לתחתית. */
export function ShoppingList({ items, shared }: { items: ShopItem[]; shared: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(items, (current, change: { id: number; checked: boolean }) =>
    current.map((item) => (item.id === change.id ? { ...item, checked: change.checked } : item)),
  );

  // ברשימה משותפת: מתעדכנים במה שהשותפים סימנו
  useEffect(() => {
    if (!shared) return;
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [shared, router]);

  const toggle = (item: ShopItem) =>
    startTransition(async () => {
      setOptimistic({ id: item.id, checked: !item.checked });
      await toggleItem(item.id, !item.checked);
    });

  const open = optimistic.filter((item) => !item.checked);
  const done = optimistic.filter((item) => item.checked);
  const row = (item: ShopItem) => (
    <li key={item.id}>
      <button
        type="button"
        onClick={() => toggle(item)}
        aria-pressed={item.checked}
        className={`flex min-h-16 w-full items-center gap-3 rounded-pm-lg border px-4 py-3 text-start shadow-card ${
          item.checked ? "border-line bg-subtle text-muted" : "border-line bg-card"
        }`}
      >
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-[10px] border-2 text-lg font-black ${
            item.checked ? "border-fresh bg-fresh text-card" : "border-[var(--pm-button-edge)] bg-card"
          }`}
        >
          {item.checked ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-lg font-bold leading-snug ${item.checked ? "line-through" : ""}`}>{item.name}</span>
          <span className="text-sm text-muted">{formatQuantity(item.quantity, item.isWeighted)}</span>
          {item.substitute && (
            <span className="mt-0.5 block text-sm font-bold text-info">במקום: {item.substitute}</span>
          )}
        </span>
        {item.price != null && <Price value={item.price} className="shrink-0 text-sm font-bold" />}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold" role="status">
        {done.length} מתוך {optimistic.length} בעגלה
        {open.length === 0 && optimistic.length > 0 && " · הכול בעגלה!"}
      </p>
      <ul className="space-y-2">{open.map(row)}</ul>
      {done.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-bold text-muted">בעגלה</h2>
          <ul className="space-y-2">{done.map(row)}</ul>
        </>
      )}
    </div>
  );
}
