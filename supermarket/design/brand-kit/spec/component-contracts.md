# חוזי רכיבים ונתוני מחיר

המסמך מתרגם את השפה העיצובית לחוזים שניתן ליישם בלי לפגוע בכנות הנתונים.

## `PriceFreshnessBadge`

קלט נדרש:

```ts
type PriceFreshness = "fresh" | "aging" | "stale" | "unknown";

interface PriceFreshnessBadgeProps {
  status: PriceFreshness;
  observedAt: string | null; // ISO-8601
  sourceName?: string;
}
```

פלט חזותי ונגיש:

- `fresh`: "עודכן לפני שעתיים" + תאריך מדויק ב־`title` או פרטים נפתחים.
- `aging`: "עודכן לפני 4 ימים".
- `stale`: "מחיר ישן - לבדוק לפני שיוצאים".
- `unknown`: "לא ידוע מתי המחיר עודכן".
- אין להפיק `fresh` מתוך צבע, מיקום ברשימה או עצם קיום מחיר.

## `CoverageSummary`

```ts
interface CoverageSummaryProps {
  knownItems: number;
  totalItems: number;
  missingItemNames: string[];
}
```

- תמיד מציגים יחס מפורש: `21 מתוך 24 פריטים`.
- כאשר `knownItems < totalItems`, הטקסט כולל "הסכום המוצג חלקי".
- רשימת החסרים זמינה בכפתור/Disclosure נגיש, לא רק tooltip.

## `BranchComparisonCard`

```ts
interface BranchComparisonCardProps {
  branchId: string;
  branchName: string;
  knownTotalAgorot: number;
  estimatedTotalAgorot?: number;
  knownItems: number;
  totalItems: number;
  freshness: PriceFreshness;
  observedAt: string | null;
  winner: boolean;
}
```

כללים:

- `knownTotalAgorot` הוא סכום הפריטים הידועים בלבד; השם אינו `total` בכוונה.
- `estimatedTotalAgorot`, אם קיים, מוצג בשורה נפרדת כ־"הערכה" עם הסבר שיטה. לעולם לא מחליף את הסכום הידוע.
- `winner=true` מותר רק כאשר `knownItems === totalItems` ו־`freshness === "fresh"`.
- כרטיס חסר נשאר ניתן להשוואה, אך ממוין אחרי כרטיסים מלאים כברירת מחדל.
- מחיר מקבל `dir="ltr"`, `font-variant-numeric: tabular-nums` ושם נגיש מלא, למשל "284 שקלים ו־90 אגורות".

## `MascotState`

```ts
type MascotState = "neutral" | "saving" | "skeptical";
```

- `saving` מופיע רק לאחר תוצאה מלאה שעומדת בתנאי הזכייה.
- `skeptical` מתאים ל־stale, unknown או coverage חלקי.
- הקמע דקורטיבי כברירת מחדל (`aria-hidden="true"`). אם הוא מעביר מידע, אותו מידע חייב להופיע גם בטקסט.

## בדיקות קבלה

- סל 24/24, fresh, הנמוך בין סלים מלאים: מקבל תג זוכה.
- סל 21/24 עם סכום מספרי נמוך יותר: אינו מקבל תג זוכה; מציג שלושה חסרים.
- מחיר ללא `observedAt`: מציג unknown ולא fresh.
- מחיר ישן: אינו משדר הצלחה דרך הקמע או ירוק.
- VoiceOver קורא שם סניף, סכום, כיסוי וזמן עדכון בסדר זה.
- ב־200% zoom אין חיתוך מחיר, כפתור או סטטוס.
- ב־RTL חץ חזרה פונה ימינה/לכיוון ההיסטוריה בהתאם לרכיב הניווט בפלטפורמה; מספרים אינם מתהפכים.
