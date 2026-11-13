# פראיירמטר - Production Brand Kit 1.0

חבילת מיתוג וממשק ראשונה לאפליקציית השוואת המחירים בעברית. החבילה משמרת את מד המחירים הקורץ, תג המחיר והפלטה הטורקיז/כתום/ורוד/סגול שנבחרו, ומתרגמת אותם למערכת נקייה שניתנת ליישום.

## התחלה מהירה

1. פתחו את `index.html` לתצוגה מרוכזת.
2. לפיתוח: העתיקו את `spec/tailwind.preset.ts` ואת `spec/tokens.css` לפרויקט.
3. לוגו: השתמשו ב־SVG המתאים לרקע; מתחת ל־180px השתמשו ב־`logo-mark.svg`.
4. אייקונים: PNG מוכן ב־512px וב־192px; מקור 1024px נמצא ב־SVG.
5. כללי מחיר, חוסרים ורעננות נמצאים ב־`spec/component-contracts.md`.

## תכולה

```text
assets/
  logo/       logo-horizontal-light.svg, logo-horizontal-dark.svg, logo-mark.svg
  icons/      app-icon-source.svg, app-icon-512.png, app-icon-192.png
  mascot/     mascot-neutral.svg, mascot-concept-3-poses.png
previews/
  brand-board.svg/.png
  mobile-login.svg/.png
  mobile-branch-comparison.svg/.png
spec/
  design-system.md
  component-contracts.md
  qa-report.md
  design-tokens.json
  tokens.css
  tailwind.preset.ts
source/
  selected-logo-reference.png
  mascot-generation-prompt.txt
```

## החלטות מרכזיות

- ה־SVG הוא מקור האמת. ה־PNG מיועד לתצוגה ולמסירה לפיתוח.
- עברית מוצגת ב־RTL, ומחירים מבודדים כ־LTR כדי שהספרות לא יתהפכו.
- תג "הכי משתלם" מותר רק לסל מלא ועדכני.
- מחיר חלקי נשאר גלוי, אך מציג יחס כיסוי ורשימת חסרים.
- סטטוס זמן אינו צבע בלבד: מוצגים גם ניסוח, זמן יחסי וחותמת זמן מדויקת במוצר.
- ההומור הרשמי: "הכול התחיל כשגיל ונורית קנו את אותו סל ושילמו מחירים שונים. גיל עוד צוחק; נורית בנתה אפליקציה."

## פונטים

המערכת מתוכננת ל־Rubik בכותרות ול־Heebo בגוף, שניהם עם תמיכה מצוינת בעברית. ב־macOS קיימים fallbacks ל־SF Hebrew. לפני יצוא סופי לדפוס ניתן להמיר את הטקסט בלוגו ל־outlines בתוכנת העיצוב; יש לשמור עותק עם טקסט חי לעריכה.

## נגישות ואיכות

- יעד: WCAG 2.2 AA.
- יעד מגע מינימלי: 44×44px.
- טבעת focus גלויה וקבועה.
- תמיכה ב־reduced motion וב־200% zoom.
- אין משמעות שמועברת בצבע בלבד.

## הערה על מסכי המוצר

שני מסכי המפתח הם דוגמאות ייצוגיות בלבד. מפרט תשעת המסכים הוא חוזה שימור זרימה: מחליפים שפה חזותית וקומפוננטות, אך לא מסלולים, לוגיקת מחירים, ולידציה או סדר פעולות קיימים.
