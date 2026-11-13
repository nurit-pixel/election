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
          className="min-w-0 flex-1 rounded-pm border border-line bg-card px-4 py-3 text-base outline-none focus:border-fresh focus:ring-2 focus:ring-focus/20"
        />
        <button className="rounded-pm bg-primary px-4 py-3 font-semibold text-on-primary active:bg-primary">חיפוש</button>
      </form>
      <BarcodeScanner itemId={itemId} />
    </div>
  );
}
