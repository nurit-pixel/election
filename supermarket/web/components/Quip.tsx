import { quip, type QuipPlace } from "@/lib/quips";

/** הערה צינית על קניות ויוקר המחיה, בכרטיס בולט משלה. רכיב שרת: נבחרת מחדש בכל טעינה של המסך. */
export function Quip({ place, className = "" }: { place: QuipPlace; className?: string }) {
  return (
    <p
      className={`relative rounded-[16px] border-2 border-[var(--pm-button-edge)] bg-card py-3 pe-4 ps-12 text-start text-base font-bold leading-snug text-ink shadow-[3px_3px_0_var(--pm-hot-pink)] ${className}`}
    >
      <span
        aria-hidden
        className="absolute start-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-pm-turquoise text-lg font-black leading-none text-pm-purple"
      >
        ״
      </span>
      {quip(place)}
    </p>
  );
}
