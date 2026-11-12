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
  const button = "h-10 w-10 rounded-lg border border-slate-300 text-lg font-semibold active:bg-slate-100";

  return (
    <div className={`flex items-center gap-1 ${pending ? "opacity-60" : ""}`}>
      <button type="button" aria-label="פחות" className={button} onClick={() => commit(current - step)}>
        −
      </button>
      <input
        aria-label={isWeighted ? "כמות בק״ג" : "כמות"}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(current)}
        className="h-10 w-14 rounded-lg border border-slate-300 text-center tabular-nums"
      />
      <button type="button" aria-label="יותר" className={button} onClick={() => commit(current + step)}>
        +
      </button>
      {isWeighted && <span className="text-sm text-slate-500">ק״ג</span>}
    </div>
  );
}
