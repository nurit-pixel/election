import { Quip } from "@/components/Quip";
import Link from "next/link";
import { getList, listSummaries, type ListItem } from "@/lib/lists";
import { hasAddress } from "@/lib/settings";
import { cookies } from "next/headers";
import { SearchBar } from "@/components/SearchBar";
import { QuantityControl } from "@/components/QuantityControl";
import {
  createList,
  deleteList,
  removeAlternative,
  removeItem,
  renameItem,
  renameList,
  switchList,
} from "./actions";

export const dynamic = "force-dynamic";

const TIP_COOKIE = "alt_tip_seen";
const WELCOME_COOKIE = "welcome_seen";

async function dismissWelcome() {
  "use server";
  (await cookies()).set(WELCOME_COOKIE, "1", { sameSite: "lax", maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
}

async function dismissTip() {
  "use server";
  (await cookies()).set(TIP_COOKIE, "1", { sameSite: "lax", maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
}

export default async function ListPage() {
  const list = await getList();
  const all = await listSummaries();
  const needsAddress = !(await hasAddress());
  const jar = await cookies();
  // מדריך הצעדים הראשונים: עד שיש כתובת ורשימה, או עד שהמשתמש סוגר אותו
  const showWelcome = (needsAddress || list.items.length === 0) && !jar.get(WELCOME_COOKIE);
  const showTip = list.items.length > 0 && !showWelcome && !jar.get(TIP_COOKIE);
  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-extrabold">{list.name}</h1>
      <details className="rounded-pm-lg border border-line bg-card p-3 text-sm shadow-card">
        <summary className="cursor-pointer select-none text-link">
          רשימות שמורות ({all.length})
        </summary>
        <ul className="mt-2 divide-y divide-subtle">
          {all.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <span className={l.id === list.id ? "font-semibold" : ""}>
                {l.name} <span className="text-xs font-normal text-muted">({l.itemCount} פריטים)</span>
              </span>
              {l.id === list.id ? (
                <span className="text-xs text-muted">פעילה</span>
              ) : (
                <form action={switchList}>
                  <input type="hidden" name="list" value={l.id} />
                  <button className="rounded-lg border border-line px-3 py-1 font-medium">מעבר</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={createList} className="mt-2 flex gap-2">
          <input
            name="name"
            required
            placeholder="רשימה חדשה (למשל: שבת, מנגל)"
            aria-label="שם רשימה חדשה"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5"
          />
          <button className="rounded-lg bg-primary px-3 py-1.5 font-medium text-on-primary">יצירה</button>
        </form>
        <form action={renameList} className="mt-2 flex gap-2">
          <input type="hidden" name="list" value={list.id} />
          <input
            name="name"
            defaultValue={list.name}
            aria-label="שם הרשימה הפעילה"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5"
          />
          <button className="rounded-lg border border-line px-3 py-1.5 font-medium">שינוי שם</button>
        </form>
        {all.length > 1 && (
          <form action={deleteList} className="mt-2">
            <input type="hidden" name="list" value={list.id} />
            <button className="text-missing">מחיקת הרשימה ״{list.name}״</button>
          </form>
        )}
      </details>
      {showWelcome && (
        <section aria-labelledby="welcome-title" className="rounded-pm-lg border-2 border-[var(--pm-button-edge)] bg-card p-4 shadow-[4px_4px_0_var(--pm-turquoise)]">
          <h2 id="welcome-title" className="text-lg font-extrabold">
            ברוכים הבאים לפראיירמטר
          </h2>
          <p className="mt-1 text-sm text-muted">שלושה צעדים, ורואים איפה הסל שלך הכי משתלם.</p>
          <Quip place="welcome" className="mt-1" />
          <ol className="mt-3 space-y-2">
            {[
              { done: !needsAddress, title: "מוסיפים כתובת ורדיוס", note: "כדי לדעת אילו סניפים קרובים אליך", href: "/settings#addresses", action: "להגדרות" },
              { done: list.items.length > 0, title: "בונים רשימה", note: "חיפוש בשם, סריקת ברקוד או צילום חשבונית, כאן למטה" },
              { done: false, title: "משווים סניפים", note: "הכפתור הכתום מופיע כשיש פריטים ברשימה", href: list.items.length > 0 && !needsAddress ? "/compare" : undefined, action: "להשוואה" },
            ].map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-[10px] text-sm font-extrabold ${
                    step.done ? "bg-fresh text-card" : "bg-pm-turquoise text-pm-purple"
                  }`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className={`font-bold ${step.done ? "text-muted line-through" : ""}`}>
                    {step.title}
                    {step.done && <span className="sr-only"> (בוצע)</span>}
                  </div>
                  {!step.done && <div className="text-muted">{step.note}</div>}
                </div>
                {!step.done && step.href && (
                  <Link href={step.href} className="shrink-0 rounded-[11px] bg-subtle px-3 py-2 text-sm font-bold">
                    {step.action}
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-subtle pt-3 text-sm">
            <Link href="/help" className="font-bold text-link underline underline-offset-4">
              ההסבר המלא
            </Link>
            <form action={dismissWelcome}>
              <button className="min-h-11 px-2 text-muted">הבנתי, אל תציגו שוב</button>
            </form>
          </div>
        </section>
      )}
      {needsAddress && !showWelcome && (
        <Link href="/settings#addresses" className="block rounded-[18px] bg-info-surface p-4 text-sm text-info">
          <span className="font-bold">מתחילים מכתובת</span>
          <span className="mt-1 block">
            מוסיפים בהגדרות כתובת ורדיוס, ואנחנו משווים את הסל בסניפים שלידך ←
          </span>
        </Link>
      )}
      <SearchBar />
      <Link
        href="/receipt"
        className="flex min-h-11 items-center justify-center gap-2 rounded-pm border border-line bg-card px-4 py-2 text-sm font-bold text-link"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />
        </svg>
        הוספה מחשבונית
      </Link>

      {showTip && (
        <form action={dismissTip} className="rounded-pm-lg border border-info/40 bg-info-surface p-4 text-sm text-info">
          <div className="font-bold">טיפ: פריט יכול להיות כמה מוצרים</div>
          <p className="mt-1">
            לא משנה לך איזה קוטג׳ או איזה מלפפון? פותחים את ״חלופות ושם הפריט״ ומוסיפים מוצרים דומים. בכל סניף נבחר
            את הזול מביניהם.
          </p>
          <button className="mt-2 min-h-11 rounded-pm border border-info/40 px-4 font-bold">הבנתי</button>
        </form>
      )}

      {list.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-pm-lg border border-dashed border-line bg-card px-5 py-10 text-center">
          <span aria-hidden className="mb-2 grid size-[76px] place-items-center rounded-[20px] bg-pm-turquoise text-4xl font-black text-pm-purple shadow-[4px_4px_0_var(--pm-hot-pink)]">
            +
          </span>
          <p className="font-bold">הרשימה ריקה</p>
          <Quip place="emptyList" className="justify-center" />
          <p className="text-sm text-muted">מחפשים מוצר לפי שם, סורקים ברקוד או מעלים חשבונית, והמוצרים נכנסים לרשימה.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {list.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </ul>
          <Quip place="list" className="px-1" />
        </>
      )}

      {list.items.length > 0 && (
        <div className="fixed inset-x-0 bottom-[78px] z-30 mb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-canvas from-80% to-transparent px-4 pb-3 pt-4">
          <Link
            href="/compare"
            className="mx-auto block max-w-2xl rounded-pm bg-primary pm-cta px-5 py-3 text-center font-bold text-on-primary"
          >
            השוואת סניפים ({list.items.length} פריטים)
          </Link>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: ListItem }) {
  const many = item.products.length > 1;
  return (
    <li id={`item-${item.id}`} className="scroll-mt-4 rounded-pm-lg border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{item.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {many ? `${item.products.length} חלופות – בכל סניף תיבחר הזולה` : "מוצר אחד"}
            {item.isWeighted && " · מוצר שקיל, כמות בק״ג"}
          </p>
        </div>
        <form action={removeItem}>
          <input type="hidden" name="item" value={item.id} />
          <button className="text-sm text-missing" aria-label={`הסרת ${item.name}`}>
            הסרה
          </button>
        </form>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <QuantityControl itemId={item.id} quantity={item.quantity} isWeighted={item.isWeighted} />
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none text-link">חלופות ושם הפריט</summary>
        <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
          {item.products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/product/${p.id}`} className="block truncate text-fresh underline-offset-2 hover:underline">
                  {p.name}
                </Link>
                <div className="text-xs text-muted">
                  {p.manufacturer && `${p.manufacturer} · `}
                  <span dir="ltr">{p.barcode}</span>
                  {p.chainName && ` · רק ב${p.chainName}`}
                </div>
              </div>
              <form action={removeAlternative}>
                <input type="hidden" name="item" value={item.id} />
                <input type="hidden" name="product" value={p.id} />
                <button className="shrink-0 text-xs text-missing">הסרה</button>
              </form>
            </li>
          ))}
        </ul>
        <Link
          href={`/search?item=${item.id}&q=${encodeURIComponent(item.name)}`}
          className="mt-2 inline-block rounded-lg border border-primary px-3 py-1.5 font-medium text-link"
        >
          הוספת חלופה
        </Link>
        <form action={renameItem} className="mt-3 flex gap-2">
          <input type="hidden" name="item" value={item.id} />
          <input
            name="name"
            defaultValue={item.name}
            aria-label="שם הפריט ברשימה"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5"
          />
          <button className="rounded-lg border border-line px-3 py-1.5 font-medium">שינוי שם</button>
        </form>
      </details>
    </li>
  );
}
