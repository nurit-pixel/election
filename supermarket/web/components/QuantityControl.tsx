"use client";

import { useState, useTransition } from "react";
import { changeQuantity } from "@/app/actions";

/** כמות: יחידות שלמות, או ק"ג בקפיצות של 0.5 למוצר שקיל (אפשר להקליד ערך מדויק). */
export function QuantityControl({ itemId, quantity, isWeighted }: { itemId: number; quantity: number; isWeighted: boolean }) {
  const [value, setValue] = useState(String(quantity));
  const [pending, startTransition] = useTransition();
  const step = isWeighted ? 0.5 : 1;
  const min = isWeighted ? 0.1 : 1;

  const commit = (next: number) => {
    const clean = Math.max(min, isWeighted ? Math.round(next * 1000) / 1000 : Math.round(next));
    setValue(String(clean));
    startTransition(() => changeQuantity(itemId, clean));
  };
  const current = Number(value) || min;
  const button = "size-11 rounded-[9px] bg-pm-turquoise text-xl font-bold text-pm-purple active:brightness-95";

  return (
    <div className={`flex items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--pm-button-edge)] bg-card dark:border-line">
      <button type="button" aria-label="פחות" className={button} onClick={() => commit(current - step)}>
        −
      </button>
      <input
        aria-label={isWeighted ? "כמות בק״ג" : "כמות"}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(current)}
        className="h-11 w-14 bg-transparent text-center font-bold tabular-nums"
      />
      <button type="button" aria-label="יותר" className={button} onClick={() => commit(current + step)}>
        +
      </button>
      </div>
      {isWeighted && <span className="text-sm text-muted">ק״ג</span>}
    </div>
  );
}
