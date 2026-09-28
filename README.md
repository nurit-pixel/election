# מטה המאבק כוח 43

משחק ניחושים משרדי לבחירות לכנסת ה-26 (27.10.2026). Next.js 15 + Supabase, פריסה ב-Vercel. המשחק על נקודות בלבד, בלי כסף.

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # ולמלא ערכים
npm run dev                  # http://localhost:3000
npm test                     # בדיקות הניקוד (vitest)
npm run lint                 # typecheck
```

## משתני סביבה

| משתנה | תיאור |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת פרויקט ה-Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (בפועל כל הטבלאות חסומות ל-anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — **רק בשרת**, אף פעם לא עם `NEXT_PUBLIC_` |
| `SESSION_SECRET` | אופציונלי. מפתח לחתימת ה-cookie של השחקנים (ברירת מחדל: ה-service role key). החלפה שלו מנתקת את כל השחקנים |
| `ADMIN_CODE` | קוד חדר המצב (`/admin`) |
| `LOCK_AT` | מועד נעילת הטופס (ISO). ברירת מחדל `2026-10-27T22:00:00+03:00` — ראו הערה ב-`NOTES.md` על שעון החורף |

## הקמת Supabase

1. פרויקט חדש ב-supabase.com.
2. SQL Editor → להריץ את `supabase/migrations/001_init.sql` (או `supabase db push` עם ה-CLI).
3. Settings → API: להעתיק את ה-URL, ה-anon key וה-service role key למשתני הסביבה.

## פריסה ל-Vercel

1. Import של הריפו ב-Vercel (Framework: Next.js, בלי הגדרות מיוחדות).
2. Settings → Environment Variables: להגדיר את כל המשתנים שלמעלה (Production + Preview).
3. Deploy. אחרי שינוי משתני סביבה צריך Redeploy.

## פריסה ל-Railway

1. railway.com ← New Project ← Deploy from GitHub repo ← `nurit-pixel/election`.
2. בשירות שנוצר ← Variables: להגדיר את משתני הסביבה שלמעלה (Supabase ×3, `ADMIN_CODE`, ואופציונלית `LOCK_AT`, `SESSION_SECRET`).
3. Settings ← Networking ← Generate Domain, כדי לקבל כתובת ציבורית.
4. ההגדרות לבנייה ולהרצה נמצאות ב-`railway.json` (build: `npm run build`, start: `npm start` על `$PORT`, בדיקת חיים ב-`/api/health`).

> משתני `NEXT_PUBLIC_*` נכנסים לקוד בזמן הבנייה. אם משנים אותם, צריך Redeploy.

## החלפת קריקטורות

כל מפלגה מוצגת מ-`public/caricatures/<key>.png` (ריבוע 400×400, רקע שקוף). כל עוד אין PNG, מוצג ה-placeholder `public/caricatures/<key>.svg` (עיגול בצבע המפלגה עם אות הפתק).

כדי להחליף: לשים קובץ `likud.png` (וכו') ב-`public/caricatures/` ולפרוס מחדש. אין צורך לשנות קוד. ה-`key` של כל מפלגה נמצא ב-`lib/parties.ts`.
אחרי שינוי אותיות או צבעים ב-`lib/parties.ts` אפשר לייצר את ה-placeholders מחדש: `npx tsx scripts/gen-placeholders.ts`.

## ליל הבחירות — הזנת תוצאות

1. להיכנס ל-`/admin` עם `ADMIN_CODE`.
2. **22:00 — הטופס ננעל אוטומטית** לפי `LOCK_AT`. אפשר גם ללחוץ "נעל טופס" ידנית (או "פתח טופס" אם צריך הארכה; "חזרה לנעילה אוטומטית" מבטל את הדריסה).
3. **מדגמים:** להזין מנדטים לכל מפלגה (0 = לא עברה), רה"מ/גוש/בונוסים אם כבר ידועים (אחרת "עוד לא ידוע" — לא מקבלים עליהם נקודות), לבחור מצב **מדגמים** → "שמור וחשב ניקוד". הלוח יציג דירוג ביניים עם התווית "לפי מדגמים — לא סופי".
4. **כל עדכון:** לשנות ערכים → "שמור וחשב ניקוד". הלוח מתרענן אצל כולם כל 60 שניות.
5. **תוצאות רשמיות:** להזין את הכל, לבחור מצב **רשמי** → "שמור וחשב ניקוד".
6. "ייצוא CSV" מוריד את כל ההימורים והניקוד (נפתח באקסל עם עברית תקינה).

> הניקוד מחושב אוטומטית בכל שמירה. התוצאות עצמן מוזנות ידנית — אין משיכה אוטומטית ממקור חיצוני.

## ניהול שחקנים

בחדר המצב ← לשונית **שחקנים**: רשימת כל המגויסים (מי הגיש, מתי עודכן, ניקוד), חיפוש, ולכל שחקן:
- **שינוי שם** — למשל לתיקון שגיאת כתיב או כפילות.
- **איפוס** — מוחק את ההימור והניקוד; השחקן נשאר ויכול למלא מחדש (עד הנעילה).
- **מחיקה** — מוחק את השחקן לגמרי, כולל ההימור והניקוד. אי אפשר לבטל.

## מבנה

- `lib/scoring.ts` — פונקציית ניקוד טהורה + דירוג ושוברי שוויון, עם בדיקות ב-`tests/scoring.test.ts`.
- `lib/copy.ts` — כל מחרוזות הממשק ושאלות הבונוס.
- `lib/parties.ts` — רשימת המפלגות.
- `app/api/*` — כל הגישה לנתונים, עם service role, אחרי בדיקת cookie חתום.
