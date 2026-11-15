import { onlineLink } from "@/lib/online";

/** כפתור להזמנה באתר הרשת, לסניף אונליין. כלום לסניף פיזי. */
export function OnlineOrder({
  store,
  className = "",
}: {
  store: { chainKey: string; chainName: string; name: string; storeType: string | null };
  className?: string;
}) {
  const href = onlineLink(store);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-11 items-center justify-center rounded-[13px] bg-pm-orange px-3 text-sm font-bold text-white ${className}`}
    >
      להזמנה אונליין ב{store.chainName} ↗
    </a>
  );
}
