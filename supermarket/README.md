# השוואת סל

אפליקציית ווב משפחתית (עברית, RTL, mobile-first) להשוואת מחירי סל קניות בין סניפי סופרמרקטים,
על בסיס קבצי שקיפות המחירים שהרשתות מפרסמות לפי חוק קידום התחרות בענפי המזון והפארם.

הפרויקט נמצא בתיקייה `supermarket/` ועצמאי לגמרי משאר המאגר.

## מצב נוכחי: שלב 1 מתוך 7

שופרסל בלבד: הורדה, פענוח, טעינה ל-PostgreSQL וחיפוש מוצר (שם או ברקוד) שמחזיר מחיר בכל סניף שנטען.

## מבנה

| תיקייה | תוכן |
|---|---|
| `db/init/` | סכמת PostgreSQL (idempotent; רצה גם בכל הפעלת ingest) |
| `ingest/` | פייתון 3.12: הורדה עם `il-supermarket-scraper`, פענוח עם `il-supermarket-parser`, טעינה למסד |
| `web/` | Next.js + TypeScript + Tailwind |
| `docker-compose.yml`, `.env.example` | הרצה והגדרות |

## הרצה

```bash
cp .env.example .env        # ולשנות סיסמה
docker compose up -d --build db web
docker compose --profile ingest run --rm --build ingest          # טעינה לפי .env
```

האפליקציה: http://localhost:3000

פקודות ingest נוספות:

```bash
docker compose --profile ingest run --rm ingest python -m ingest run --chain SHUFERSAL --stores 1,3,11
docker compose --profile ingest run --rm ingest python -m ingest run --chain SHUFERSAL --all-stores
docker compose --profile ingest run --rm ingest python -m ingest run --chain SHUFERSAL --force
docker compose --profile ingest run --rm ingest python -m ingest status
docker compose --profile ingest run --rm --no-deps ingest python -m pytest -q tests
```

## איך הטעינה עובדת

1. ה-scraper מוריד את קובץ הסניפים ואת קובץ ה-PriceFull העדכני של כל סניף מבוקש לתיקיית `dumps` (volume).
2. כל קובץ מפוענח ונטען בטרנזקציה אחת: מחירי הסניף מוחלפים בתמונת המצב החדשה.
   אם קובץ נכשל, המחירים הקודמים של הסניף נשארים, הקובץ נשאר לניסיון הבא ושאר הקבצים ממשיכים.
3. כל ריצה נרשמת ב-`ingest_runs` (סטטוס `ok` / `partial` / `failed`), וכל קובץ שנטען ב-`ingest_files`.

כללים שכבר מיושמים:

- התאמת מוצרים לפי ברקוד בלבד. קוד פנימי של רשת (`ItemType=0`) נשמר כמוצר של אותה רשת בלבד.
- `bIsWeighted=1`: המחיר נשמר ומוצג כמחיר לק״ג.
- ליד כל מחיר מוצג מתי עודכן הקובץ; קובץ ישן מ-`STALE_PRICE_HOURS` (36) שעות מסומן.

## הערות

- גרסאות הספריות: `il-supermarket-scraper==1.1.0`, `il-supermarket-parser==1.0.16`. ה-scraper דורש Python קטן מ-3.13.
- חלק מאתרי הרשתות חוסמים גישה מחוץ לישראל; את ה-ingest כדאי להריץ משרת בישראל.
- בשלב 1 הסניפים לטעינה נקבעים ב-`SHUFERSAL_STORE_IDS`. משלב 2 הבחירה תהיה לפי רדיוס סביב הכתובות השמורות.
