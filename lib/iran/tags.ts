import type { Headline, TaggedHeadline } from "./types";

// תיוג כותרות לפי מילות מפתח, בלי מודל שפה: לאיזה אינדיקטור הכותרת נוגעת.
// התיוג רק מצביע על הכותרת. את הערך מזיז המשתמש בעצמו.
export const TAG_RULES: { id: string; label: string; re: RegExp }[] = [
  { id: "hormuz", label: "הורמוז והסגר", re: /hormuz|tanker|blockade|הורמוז|מכלית|מכליות|סגר ימי/i },
  { id: "proxies", label: "שלוחים", re: /houthi|hezbollah|yemen|lebanon|aramco|riyadh|חות'?ים|חיזבאללה|תימן|לבנון|ארמקו|ריאד/i },
  { id: "missiles", label: "טילים", re: /ballistic|missile (production|factory|program)|khojir|טילים בליסטיים|ייצור טילים|מפעלי טילים/i },
  { id: "nuke_activity", label: "גרעין", re: /nuclear site|enrich|uranium|fordow|natanz|isfahan|pickaxe|אתר גרעין|העשרה|אורניום|פורדו|נתנז|איספהאן/i },
  { id: "iaea", label: 'סבא"א', re: /iaea|grossi|inspector|סבא"א|גרוסי|פקחים/i },
  { id: "talks", label: "שיחות", re: /talks|negotiat|deal|witkoff|araghchi|qatar|mediat|מו"מ|משא ומתן|הסכם|ויטקוף|עראקצ'י|קטאר|תיווך/i },
  { id: "us_prep", label: "היערכות אמריקאית", re: /pentagon|centcom|carrier|b-2|strike plan|marines|פנטגון|סנטקום|נושאת מטוסים|תוכנית תקיפה|נחתים/i },
  { id: "trump_pre", label: "טראמפ", re: /trump|טראמפ/i },
  { id: "bibi", label: "נתניהו", re: /netanyahu|נתניהו/i },
  { id: "iranlead", label: "הנהגת איראן", re: /khamenei|pezeshkian|irgc|revolutionary guard|rezaei|חמינאי|פזשכיאן|משמרות המהפכה|רזאי/i },
  { id: "homefront", label: "עורף", re: /home front|sirens|interceptor|פיקוד העורף|אזעקות|יירוט/i },
  { id: "il_elect", label: "בחירות", re: /election|knesset|poll|בחירות|כנסת|סקר/i },
  { id: "iran_econ", label: "כלכלת איראן", re: /rial|iran('s)? economy|inflation|ריאל|כלכלת איראן|אינפלציה/i },
];

export function tagHeadline(h: Headline): TaggedHeadline {
  const tags = TAG_RULES.filter((r) => r.re.test(h.title)).map((r) => r.id);
  return { ...h, tags };
}

// סיכום קצר: כמה כותרות נאספו ואילו נושאים חוזרים הכי הרבה
export function summarize(items: TaggedHeadline[]): string {
  if (!items.length) return "לא נמצאו כותרות חדשות על איראן ב-30 השעות האחרונות.";
  const counts = new Map<string, number>();
  for (const it of items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, n]) => `${TAG_RULES.find((r) => r.id === id)!.label} (${n})`);
  return `נאספו ${items.length} כותרות מהשעות האחרונות.` + (top.length ? ` הנושאים הבולטים: ${top.join(", ")}.` : "");
}
