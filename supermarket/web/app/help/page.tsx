import { Quip } from "@/components/Quip";
import Link from "next/link";

const CARD = "rounded-pm-lg border border-line bg-card p-4 shadow-card";

const STEPS: { title: string; body: string; href?: string; action?: string }[] = [
  {
    title: "מוסיפים כתובת",
    body: "בהגדרות כותבים רחוב, מספר ועיר, ובוחרים רדיוס. משווים רק בין הסניפים שבתוך הרדיוס. אפשר לשמור עד שלוש כתובות, למשל בית ועבודה.",
    href: "/settings#addresses",
    action: "להוספת כתובת",
  },
  {
    title: "בונים רשימה",
    body: "מחפשים מוצר לפי שם, סורקים ברקוד במצלמה, או מעלים צילום של חשבונית ומאשרים את המוצרים שזוהו. לכל פריט קובעים כמות; מוצר שקיל נמדד בק״ג.",
    href: "/",
    action: "לרשימה",
  },
  {
    title: "משווים סניפים",
    body: "במסך ההשוואה רואים כמה עולה הסל בכל סניף, כולל מבצעים. סניף שחסר בו פריט מוצג בנפרד ולא מקבל את התואר ״הכי משתלם״. לחיצה על סניף מראה את הפירוט.",
    href: "/compare",
    action: "להשוואה",
  },
];

const MORE: { title: string; body: string }[] = [
  {
    title: "חלופות",
    body: "לא משנה לך איזה קוטג׳? פותחים ״חלופות ושם הפריט״ ומוסיפים מוצרים דומים. בכל סניף נבחר הזול מביניהם.",
  },
  {
    title: "פיצול לשני סניפים",
    body: "כשקנייה בשני סניפים חוסכת מספיק, מופיעה הצעה בראש מסך ההשוואה. את הסכום שמעליו זה משתלם לך קובעים בהגדרות.",
  },
  {
    title: "מועדוני לקוחות",
    body: "בהגדרות מסמנים את המועדונים שיש לך. מבצע של מועדון נכנס לחישוב רק אם סימנת אותו; אחרת הוא מוצג כחיסכון אפשרי.",
  },
  {
    title: "מעקב והתראות",
    body: "בדף של מוצר אפשר להוסיף אותו למעקב ולקבוע מחיר יעד. התראה מופיעה כשהמחיר משתנה ב-10% ומעלה, או יורד אל היעד.",
  },
  {
    title: "כמה המחירים עדכניים",
    body: "המחירים מגיעים מהקבצים שהרשתות מפרסמות, ומתעדכנים פעם ביום. ליד כל מחיר כתוב מתי עודכן, ומחיר ישן מיום וחצי מסומן. באזור חדש לוקח כמה דקות עד שהמחירים נטענים, ולא כל הרשתות מפרסמות את כל הסניפים.",
  },
  {
    title: "קיצור דרך במסך הבית",
    body: "באייפון: כפתור השיתוף בספארי ← ״הוסף למסך הבית״. באנדרואיד: התפריט של כרום ← ״הוספה למסך הבית״. האפליקציה תיפתח כמו אפליקציה רגילה.",
  },
  {
    title: "החשבון שלך",
    body: "הרשימות, הכתובות וההגדרות שמורות לחשבון Google שלך ואינן גלויות למשתמשים אחרים. יציאה: בהגדרות, בכרטיס העליון.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1>איך זה עובד</h1>
        <p className="mt-1 text-sm text-muted">שלושה צעדים, ואז רואים איפה הסל שלך הכי משתלם.</p>
        <Quip place="help" className="mt-2" />
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className={`${CARD} flex gap-3`}>
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-pm-turquoise font-extrabold text-pm-purple"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h2 className="font-bold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              {step.href && (
                <Link href={step.href} className="mt-2 inline-block text-sm font-bold text-link underline underline-offset-4">
                  {step.action} ←
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <h2 className="pt-2 text-lg font-bold">עוד דברים שכדאי לדעת</h2>
      <div className={`${CARD} divide-y divide-subtle p-0`}>
        {MORE.map((item) => (
          <details key={item.title} className="group px-4">
            <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 font-bold">
              {item.title}
              <span aria-hidden className="text-pm-pink transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted">{item.body}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
