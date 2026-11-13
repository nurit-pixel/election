# מודל זיהוי טקסט לחשבוניות

`Hebrew.traineddata` הוא מודל הכתב העברי של Tesseract (עברית, ספרות ואותיות לטיניות), מתוך
[tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (`script/Hebrew.traineddata`), ברישיון Apache-2.0.
הוא נשמר כאן כדי שבניית האפליקציה לא תהיה תלויה בהורדה בזמן הבנייה.

בבדיקות הוא קרא חשבוניות טוב יותר משילוב המודלים `heb+eng`, שמחליף מילים בעברית באותיות לטיניות, וממודל `heb` לבדו, שטועה בספרות.
