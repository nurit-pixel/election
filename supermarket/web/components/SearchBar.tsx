import { BarcodeScanner } from "./BarcodeScanner";

export function SearchBar({ query = "", itemId, autoFocus = false }: { query?: string; itemId?: number; autoFocus?: boolean }) {
  return (
    <div className="flex gap-2">
      <form action="/search" className="flex min-w-0 flex-1 gap-2">
        {itemId && <input type="hidden" name="item" value={itemId} />}
        <input
          name="q"
          defaultValue={query}
          type="search"
          enterKeyHint="search"
          placeholder="שם מוצר או ברקוד"
          autoFocus={autoFocus}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white active:bg-emerald-700">חיפוש</button>
      </form>
      <BarcodeScanner itemId={itemId} />
    </div>
  );
}
