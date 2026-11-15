import { cookies } from "next/headers";
import Link from "next/link";
import { A11Y_COOKIE, parseA11y, type TextSize } from "@/lib/a11y";
import { saveA11y, resetA11y } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "נגישות · פראיירמטר" };

/** תאריך עדכון ההצהרה. לעדכן כשמשנים את רמת הנגישות או את המגבלות. */
const STATEMENT_DATE = "15.11.2026";

const SIZES: { value: TextSize; label: string }[] = [
  { value: "normal", label: "רגיל" },
  { value: "large", label: "גדול" },
  { value: "xlarge", label: "גדול מאוד" },
];

const TOGGLES = [
  { name: "contrast", label: "ניגודיות גבוהה", hint: "טקסט משני וגבולות כהים יותר" },
  { name: "links", label: "הדגשת קישורים", hint: "קו תחתון לכל הקישורים" },
  { name: "readable", label: "ריווח קריא", hint: "יותר רווח בין אותיות, מילים ושורות" },
  { name: "still", label: "עצירת אנימציות", hint: "בלי תנועה ומעברים במסך" },
] as const;

export default async function AccessibilityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const prefs = parseA11y((await cookies()).get(A11Y_COOKIE)?.value);
  const { saved } = await searchParams;
  const contact = process.env.ACCESSIBILITY_CONTACT?.trim();

  return (
    <div className="space-y-6">
      <h1>נגישות</h1>

      <section aria-labelledby="prefs-title" className="space-y-4 rounded-pm-lg border border-line bg-card p-4 shadow-card">
        <h2 id="prefs-title" className="text-lg font-bold">
          התאמת התצוגה
        </h2>
        {saved && (
          <p role="status" className="rounded-pm bg-fresh-surface p-3 text-sm font-bold text-fresh">
            נשמר. ההגדרות חלות על כל מסכי האפליקציה במכשיר הזה.
          </p>
        )}
        <form action={saveA11y} className="space-y-5">
          <fieldset>
            <legend className="mb-2 font-bold">גודל הטקסט</legend>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((size) => (
                <label
                  key={size.value}
                  className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[13px] border-2 border-line px-2 font-bold has-[:checked]:border-[var(--pm-button-edge)] has-[:checked]:bg-subtle"
                >
                  <input type="radio" name="text" value={size.value} defaultChecked={prefs.text === size.value} />
                  {size.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold">תצוגה</legend>
            {TOGGLES.map((t) => (
              <label key={t.name} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[13px] border border-line p-3">
                <input type="checkbox" name={t.name} defaultChecked={prefs[t.name]} className="mt-1 size-5 shrink-0" />
                <span>
                  <span className="block font-bold">{t.label}</span>
                  <span className="block text-sm text-muted">{t.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <button className="min-h-12 flex-1 rounded-[13px] border-2 border-[var(--pm-button-edge)] bg-primary px-4 font-bold text-on-primary">
              שמירה
            </button>
          </div>
        </form>
        <form action={resetA11y}>
          <button className="min-h-11 rounded-[13px] bg-subtle px-4 text-sm font-bold">חזרה לתצוגה הרגילה</button>
        </form>
        <p className="text-sm text-muted">
          אפשר גם להגדיל את המסך עם תנועת צביטה, ולהשתמש בקורא המסך של הטלפון (VoiceOver באייפון, TalkBack באנדרואיד).
          מצב כהה נבחר ב<Link href="/settings" className="underline">הגדרות</Link>.
        </p>
      </section>

      <section id="statement" aria-labelledby="statement-title" className="scroll-mt-4 space-y-3 text-[15px] leading-relaxed">
        <h2 id="statement-title" className="text-lg font-bold">
          הצהרת נגישות
        </h2>
        <p>
          פראיירמטר היא אפליקציה משפחתית להשוואת מחירי סלי קניות, שנבנתה ומופעלת באופן פרטי ע״י נורית תמם. אנחנו רוצים
          שכל אחד יוכל להשתמש בה, כולל אנשים עם מוגבלות, ופועלים לכך שתעמוד בדרישות תקן ישראלי 5568 ברמה AA, המבוסס על
          הנחיות WCAG 2.1.
        </p>
        <h3 className="font-bold">מה עשינו</h3>
        <ul className="list-disc space-y-1 ps-5">
          <li>האפליקציה בעברית, מימין לשמאל, ומוגדרת כך לקוראי מסך.</li>
          <li>אפשר להשתמש בה כולה במקלדת, עם מסגרת בולטת סביב הרכיב שבפוקוס וקישור &quot;דילוג לתוכן&quot; בתחילת כל מסך.</li>
          <li>לכל הכפתורים, השדות והאייקונים יש שמות שקוראי מסך מקריאים, וכותרות שמארגנות כל מסך.</li>
          <li>ניגודיות הצבעים עומדת ביחס של 4.5:1 לפחות, במצב בהיר ובמצב כהה, ונבדקת בכלי בדיקה אוטומטי.</li>
          <li>מד המחיר והגרפים מתוארים גם בטקסט, והמידע לא מועבר בצבע בלבד.</li>
          <li>בתפריט שלמעלה: הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, ריווח קריא ועצירת אנימציות. האפליקציה מכבדת
            גם את הגדרת &quot;הפחתת תנועה&quot; של הטלפון.</li>
          <li>אזורי המגע בגודל 44 פיקסלים לפחות, והמסכים עובדים גם בהגדלה.</li>
        </ul>
        <h3 className="font-bold">מגבלות ידועות, ומה החלופה</h3>
        <ul className="list-disc space-y-1 ps-5">
          <li>מפת הסניפים פחות נוחה לקוראי מסך. את אותו מידע יש בתצוגת הרשימה במסך ההשוואה (בררת המחדל).</li>
          <li>סריקת ברקוד במצלמה: אפשר תמיד להקליד את הברקוד או את שם המוצר בחיפוש.</li>
          <li>קריאת חשבונית מתמונה לא תמיד מדויקת. כל מוצר מוצג לאישור ולתיקון לפני שהוא נכנס לרשימה.</li>
          <li>שמות המוצרים מגיעים כפי שהרשתות מפרסמות אותם, לפעמים עם קיצורים, ולכן קורא מסך עשוי להקריא אותם בצורה לא טבעית.</li>
        </ul>
        <h3 className="font-bold">נתקלתם בבעיה?</h3>
        <p>
          אם משהו באפליקציה לא נגיש לכם, נשמח לשמוע ולתקן.{" "}
          {contact ? (
            <>
              רכזת הנגישות: נורית תמם, <span dir="ltr">{contact}</span>.
            </>
          ) : (
            <>רכזת הנגישות: נורית תמם. פנו אליה בדרך שבה קיבלתם את הקישור לאפליקציה.</>
          )}{" "}
          כדאי לציין באיזה מסך הייתה הבעיה, מה ניסיתם לעשות, ובאיזה טלפון, דפדפן או קורא מסך השתמשתם.
        </p>
        <p className="text-sm text-muted">ההצהרה עודכנה ב-{STATEMENT_DATE}.</p>
      </section>
    </div>
  );
}
