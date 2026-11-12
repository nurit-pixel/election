# השוואת סל

אפליקציית ווב משפחתית (עברית, RTL, mobile-first) להשוואת מחירי סל קניות בין סניפי סופרמרקטים,
על בסיס קבצי שקיפות המחירים שהרשתות מפרסמות לפי חוק קידום התחרות בענפי המזון והפארם.

הפרויקט נמצא בתיקייה `supermarket/` ועצמאי לגמרי משאר המאגר.

## מצב נוכחי: שלב 2 מתוך 7

- כל הרשתות (33 מקורות): רשימת סניפים ארצית, geocoding עם cache, ומחירים לסניפים שברדיוס הכתובות השמורות.
- חיפוש מוצר (שם או ברקוד) שמחזיר מחיר בכל סניף שנטען.
- מסך הגדרות: כתובות ורדיוס, וסטטוס טעינה לכל רשת מתוך `ingest_runs`.

## מבנה

| תיקייה | תוכן |
|---|---|
| `db/init/` | סכמת PostgreSQL (idempotent; רצה גם בכל הפעלת ingest) |
| `ingest/` | פייתון 3.12: הורדה, פענוח עם `il-supermarket-parser`, טעינה למסד, geocoding ו-worker |
| `web/` | Next.js + TypeScript + Tailwind |
| `docker-compose.yml`, `.env.example` | הרצה והגדרות |

## הרצה

```bash
cp .env.example .env        # ולשנות סיסמה
docker compose up -d --build
```

האפליקציה: http://localhost:3000

בהפעלה הראשונה ה-worker מוריד את רשימות הסניפים של כל הרשתות ומתחיל geocoding ברקע
(בקשה אחת בשנייה ל-Nominatim, כלומר כשעה-שעתיים לכל הארץ, פעם אחת בלבד).
אחר כך מוסיפים כתובת במסך ההגדרות, והמחירים של הסניפים שלידה נטענים מיד.

פקודות ידניות (ה-worker עושה את אותו הדבר לפי בקשות מהאפליקציה):

```bash
docker compose exec ingest python -m ingest status
docker compose exec ingest python -m ingest stores                 # רשימות סניפים, כל הרשתות
docker compose exec ingest python -m ingest prices                 # מחירים לסניפים ברדיוס
docker compose exec ingest python -m ingest prices --chain RAMI_LEVY --stores 1,39
docker compose exec ingest python -m ingest prices --all-stores    # כל הארץ
docker compose exec ingest python -m ingest address "בית" "הרצל 1, תל אביב" --radius 5
docker compose exec ingest python -m pytest -q tests
```

## מקורות הנתונים

| מקור | רשתות | איך מורידים |
|---|---|---|
| `prices.shufersal.co.il` | שופרסל | `il-supermarket-scraper` |
| `url.publishedprices.co.il` (Cerberus) | רמי לוי, יוחננוף, אושר עד, טיב טעם, דור אלון, יילו, קשת טעמים, פרש מרקט, סטופ מרקט, סאלח דבאח, סופר יודה, פוליצר | מוריד משלנו (`ingest/ingest/cerberus.py`) בממשק הווב: `GET /login`, `csrftoken` מתגית meta + עוגייה, `POST /login/user`, `/file/json/dir`, `/file/d/<שם>`. הספרייה ניגשת לרשתות האלה ב-FTP |
| `prices.carrefour.co.il`, `laibcatalog.co.il`, `shop.hazi-hinam.co.il`, `*.binaprojects.com`, `prices.super-pharm.co.il` ועוד | קרפור/יינות ביתן/מגה, ויקטורי, מחסני השוק, חצי חינם, סופר-פארם, גוד פארם ורשתות קטנות | `il-supermarket-scraper` |

רוב האתרים שבשורה השלישית חוסמים גישה מחוץ לישראל, ולכן את ה-ingest צריך להריץ משרת בישראל.
רשת שנכשלת מסומנת במסך ההגדרות ואינה עוצרת את השאר.

## איך הטעינה עובדת

1. **סניפים:** קובץ ה-Stores העדכני של כל רשת נטען לטבלת `stores`. עיר שמפורסמת כסמל יישוב של הלמ"ס מתורגמת לשם.
2. **Geocoding:** כל סניף מנוסה פעם אחת (עד שהכתובת שלו משתנה). כל שאילתה נשמרת ב-`geocode_cache`.
   אם הכתובת המלאה לא נמצאת, הסניף ממוקם לפי העיר (`geocode_precision = city`).
3. **מחירים:** לכל רשת מורידים את ה-PriceFull העדכני של הסניפים שברדיוס כתובת שמורה
   (או של כל הסניפים כש-`INGEST_ALL_STORES=true`). כל קובץ נטען בטרנזקציה אחת ומחליף את מחירי הסניף.
   אם קובץ נכשל, המחירים הקודמים נשארים והסניף יסומן "לא עודכן".
4. כל ריצה נרשמת ב-`ingest_runs` (`ok` / `partial` / `failed`), וכל קובץ שנטען ב-`ingest_files`.

כללים שכבר מיושמים:

- התאמת מוצרים לפי ברקוד בלבד. קוד פנימי של רשת (`ItemType=0`) נשמר כמוצר של אותה רשת בלבד.
- `bIsWeighted=1`: המחיר נשמר ומוצג כמחיר לק״ג.
- ליד כל מחיר מוצג מתי עודכן הקובץ; קובץ ישן מ-`STALE_PRICE_HOURS` (36) שעות מסומן.

## הערות

- גרסאות הספריות: `il-supermarket-scraper==1.1.0`, `il-supermarket-parser==1.0.16`. ה-scraper דורש Python קטן מ-3.13.
- אפשר להחליף את שירות ה-geocoding ב-`GEOCODER_URL` (כל שירות תואם Nominatim).
