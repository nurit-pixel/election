import { quip, type QuipPlace } from "@/lib/quips";

/** הערה צינית קטנה על קניות ויוקר המחיה. רכיב שרת: נבחרת מחדש בכל טעינה של המסך. */
export function Quip({ place, className = "" }: { place: QuipPlace; className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-[13px] leading-relaxed text-muted ${className}`}>
      <span aria-hidden className="mt-[7px] size-2 shrink-0 rotate-45 bg-pm-pink" />
      <span>{quip(place)}</span>
    </p>
  );
}
