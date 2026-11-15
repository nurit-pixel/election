import { submitReview, removeReview } from "@/app/store/[id]/actions";
import { formatUpdated } from "@/lib/format";
import { MAX_COMMENT, type StoreReviews as Data } from "@/lib/reviews";
import { Stars } from "./Stars";

const CARD = "rounded-pm-lg border border-line bg-card p-4 shadow-card";
const LABELS = ["", "גרוע", "לא משהו", "סביר", "טוב", "מצוין"];

/** חוות דעת על הסניף: הדירוג הממוצע, הטופס של המשתמש, וחוות הדעת של אחרים. */
export function StoreReviews({ storePk, data }: { storePk: number; data: Data }) {
  return (
    <section aria-labelledby="reviews-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="reviews-title" className="text-lg font-bold">
          חוות דעת על הסניף
        </h2>
        {data.average != null ? (
          <Stars value={data.average} count={data.count} />
        ) : (
          <span className="text-sm text-muted">עוד אין חוות דעת</span>
        )}
      </div>

      <form action={submitReview} className={`${CARD} space-y-3`}>
        <input type="hidden" name="store" value={storePk} />
        <fieldset>
          <legend className="text-sm font-bold">{data.mine ? "חוות הדעת שלך" : "איך היה בסניף?"}</legend>
          {/* כוכבים מ-1 עד 5; בכיוון ימין-לשמאל הכוכב הראשון מימין */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  required
                  defaultChecked={data.mine?.rating === n}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[12px] border border-line px-2 text-xs peer-checked:border-[var(--pm-button-edge)] peer-checked:bg-pm-turquoise peer-checked:font-bold peer-checked:text-pm-purple peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--pm-focus)]">
                  <span aria-hidden className="text-base text-pm-orange">
                    {"★".repeat(n)}
                  </span>
                  {LABELS[n]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-bold">מה כדאי לדעת?</span> <span className="text-muted">(לא חובה)</span>
          <textarea
            name="comment"
            maxLength={MAX_COMMENT}
            rows={3}
            defaultValue={data.mine?.comment ?? ""}
            placeholder="תורים, ניקיון, מבחר, חניה, שירות…"
            className="mt-1 block w-full rounded-[13px] border border-line bg-card px-3 py-2 text-base"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <button className="min-h-11 rounded-pm bg-primary px-5 text-on-primary">
            {data.mine ? "עדכון חוות הדעת" : "פרסום חוות הדעת"}
          </button>
          {data.mine && (
            <button formAction={removeReview} formNoValidate className="min-h-11 px-2 text-sm text-missing">
              מחיקה
            </button>
          )}
        </div>
        <p className="text-xs text-muted">חוות הדעת גלויה לכל המשתמשים, עם השם הפרטי שלך בלבד.</p>
      </form>

      {data.recent.length > 0 && (
        <ul className={`${CARD} divide-y divide-subtle p-0`}>
          {data.recent.map((review) => (
            <li key={review.id} className="px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">
                  {review.author} <Stars value={review.rating} className="ms-1" />
                </span>
                <time dateTime={new Date(review.updatedAt).toISOString()} className="shrink-0 text-xs text-muted">
                  {formatUpdated(review.updatedAt)}
                </time>
              </div>
              {review.comment && (
                <p dir="auto" className="mt-1 whitespace-pre-line break-words">
                  {review.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
