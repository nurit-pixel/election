export type Party = {
  key: string;
  name: string;
  leader: string;
  letters: string;
  color: string;
  pmCandidate: boolean;
  trivia: string;
};

// רשימת פתיחה. אותיות הפתק, צבעים וראשי רשימות — לאמת מול פרסום ועדת הבחירות לפני ההשקה.
export const PARTIES: Party[] = [
  {
    key: "likud",
    name: "הליכוד",
    leader: "בנימין נתניהו",
    letters: "מחל",
    color: "#1F4E9E",
    pmCandidate: true,
    trivia: "הליכוד הוקם ב-1973 כאיחוד של כמה מפלגות — ומכאן גם שמו.",
  },
  {
    key: "beyachad",
    name: "ביחד",
    leader: "נפתלי בנט",
    letters: "ב",
    color: "#0B7A75",
    pmCandidate: true,
    trivia: "רשימה חדשה שרצה לראשונה בבחירות לכנסת ה-26.",
  },
  {
    key: "yashar",
    name: "ישר!",
    leader: "גדי איזנקוט",
    letters: "י",
    color: "#E09F00",
    pmCandidate: true,
    trivia: "סימן הקריאה הוא חלק רשמי משם הרשימה.",
  },
  {
    key: "democrats",
    name: "הדמוקרטים",
    leader: "יאיר גולן",
    letters: "אמת",
    color: "#C8102E",
    pmCandidate: true,
    trivia: "הדמוקרטים הוקמה ב-2024 מאיחוד של מפלגת העבודה ומרצ.",
  },
  {
    key: "shas",
    name: 'ש"ס',
    leader: "אריה דרעי",
    letters: "שס",
    color: "#1A2B5F",
    pmCandidate: false,
    trivia: 'ש"ס הם ראשי תיבות של "שומרי ספרד". הרשימה רצה לראשונה לכנסת ב-1984.',
  },
  {
    key: "utj",
    name: "יהדות התורה",
    leader: "",
    letters: "ג",
    color: "#3A3A3A",
    pmCandidate: false,
    trivia: "יהדות התורה היא רשימה משותפת של אגודת ישראל ודגל התורה.",
  },
  {
    key: "rz",
    name: "הציונות הדתית",
    leader: "בצלאל סמוטריץ'",
    letters: "ט",
    color: "#E0701B",
    pmCandidate: false,
    trivia: "השם לקוח מהזרם הרעיוני שפעל עוד לפני קום המדינה.",
  },
  {
    key: "otzma",
    name: "עוצמה יהודית",
    leader: "איתמר בן גביר",
    letters: "עצ",
    color: "#C9A400",
    pmCandidate: false,
    trivia: 'בבחירות 2013 הרשימה רצה בשם "עוצמה לישראל".',
  },
  {
    key: "beiteinu",
    name: "ישראל ביתנו",
    leader: "אביגדור ליברמן",
    letters: "ל",
    color: "#1565C0",
    pmCandidate: true,
    trivia: "ישראל ביתנו הוקמה ב-1999, ומאז האות ל' מזוהה איתה בפתק.",
  },
  {
    key: "joint",
    name: "הרשימה המשותפת",
    leader: "",
    letters: "ום",
    color: "#2E7D32",
    pmCandidate: false,
    trivia: "הרשימה המשותפת הוקמה לראשונה לקראת הבחירות של 2015.",
  },
  {
    key: "raam",
    name: 'רע"ם',
    leader: "מנסור עבאס",
    letters: "עם",
    color: "#1B8E5A",
    pmCandidate: false,
    trivia: 'רע"ם הם ראשי תיבות של "הרשימה הערבית המאוחדת".',
  },
  {
    key: "miluim",
    name: "המילואימניקים והכלכלית",
    leader: "יועז הנדל",
    letters: "מ",
    color: "#5E7A2E",
    pmCandidate: false,
    trivia: "רשימה חדשה ששמה מחבר בין שני נושאים: מילואים וכלכלה.",
  },
  {
    key: "noam",
    name: "נעם לישראל",
    leader: "אבי מעוז",
    letters: "נ",
    color: "#5B3A8E",
    pmCandidate: false,
    trivia: "נעם הוקמה ב-2019 ורצה לראשונה לכנסת באותה שנה.",
  },
  {
    key: "haredi_public",
    name: "הציבור החרדי",
    leader: "מוטי לייטנר",
    letters: "ק",
    color: "#6D4C41",
    pmCandidate: false,
    trivia: "רשימה חדשה שרצה לראשונה בבחירות לכנסת ה-26.",
  },
];

export const PARTY_KEYS = PARTIES.map((p) => p.key);

export const PARTY_BY_KEY: Record<string, Party> = Object.fromEntries(PARTIES.map((p) => [p.key, p]));

export const PM_PARTIES = PARTIES.filter((p) => p.pmCandidate);

export const TOTAL_SEATS = 120;
export const MAX_SEATS_PER_PARTY = 50;

export function caricatureSrc(key: string) {
  return `/caricatures/${key}.png`;
}

export function placeholderSrc(key: string) {
  return `/caricatures/${key}.svg`;
}
