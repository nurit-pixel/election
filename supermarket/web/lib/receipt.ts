import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchProducts } from "./search";
import { parseReceiptText } from "./receipt-parse";
import {
  normalizeBarcode,
  normalizeShortCode,
  shortCodeIsCertain,
  queryVariants,
  type Candidate,
  type Confidence,
  type MatchedLine,
  type ReceiptLine,
} from "./receipt-match";

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"];
const PDF_PAGES = 4;

export const isSupportedType = (type: string) => type === "application/pdf" || IMAGE_TYPES.includes(type);

/** שגיאה עם הודעה שמותר להציג למשתמש */
export class ReceiptError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}

/** הרצת כלי שורת פקודה; מחזיר את הפלט. הכלים (tesseract, poppler) מותקנים בתמונת ה-Docker. */
function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (!error) return resolve(stdout);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`receipt: ${command} is not installed`);
        return reject(new ReceiptError("קריאת חשבוניות לא מותקנת בשרת. מריצים את האפליקציה דרך Docker.", 503));
      }
      console.error(`receipt: ${command} failed`, error.message.slice(0, 300));
      reject(new ReceiptError("לא הצלחנו לקרוא את הקובץ. מנסים צילום אחר, חד ומואר."));
    });
  });
}

// מודל הכתב העברי (עברית + ספרות) שנמצא ב-web/ocr
const TESSDATA = process.env.RECEIPT_TESSDATA || join(process.cwd(), "ocr");

/** זיהוי טקסט בתמונה, כגוש טקסט אחיד (מתאים לחשבונית). */
const ocr = (imagePath: string) =>
  run("tesseract", [imagePath, "stdout", "--tessdata-dir", TESSDATA, "-l", "Hebrew", "--psm", "6"]);

/** הטקסט של החשבונית. הקובץ מעובד בשרת בלבד ונמחק בסיום. */
async function receiptText(data: Buffer, mediaType: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "receipt-"));
  try {
    if (mediaType !== "application/pdf") {
      const path = join(dir, "receipt");
      await writeFile(path, data);
      return await ocr(path);
    }
    const pdf = join(dir, "receipt.pdf");
    await writeFile(pdf, data);
    // PDF דיגיטלי מכיל טקסט אמיתי; PDF סרוק עובר OCR עמוד-עמוד
    const text = await run("pdftotext", ["-layout", "-l", String(PDF_PAGES), pdf, "-"]);
    if ((text.match(/[א-ת]/g) ?? []).length >= 20) return text;
    await run("pdftoppm", ["-r", "200", "-png", "-l", String(PDF_PAGES), pdf, join(dir, "page")]);
    const pages = (await readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".png")).sort();
    const texts: string[] = [];
    for (const page of pages) texts.push(await ocr(join(dir, page)));
    return texts.join("\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** קריאת החשבונית: מחזיר את שורות המוצרים שבה. */
export async function readReceipt(data: Buffer, mediaType: string): Promise<ReceiptLine[]> {
  return parseReceiptText(await receiptText(data, mediaType));
}

const CANDIDATES = 5;

async function matchLine(line: ReceiptLine): Promise<MatchedLine> {
  // מוצרים עם ברקוד רגיל קודמים למוצרים עם קוד פנימי של רשת אחת
  const toCandidates = (products: Awaited<ReturnType<typeof searchProducts>>, allowInternal: boolean): Candidate[] =>
    products
      .filter((p) => allowInternal || !p.internal)
      .sort((a, b) => Number(a.internal) - Number(b.internal))
      .slice(0, CANDIDATES)
      .map((p) => ({
        id: p.id,
        name: p.name,
        manufacturer: p.manufacturer,
        isWeighted: p.isWeighted,
        chainName: p.internal ? p.chainName : null,
        minPrice: p.prices.length ? Math.min(...p.prices.map((x) => Number(x.price))) : null,
      }));

  // 1. קודם כול לפי הקוד שהודפס בחשבונית: ברקוד מלא, ואם אין – קוד פנימי קצר של הרשת
  const barcode = normalizeBarcode(line.barcode);
  if (barcode) {
    const found = toCandidates(await searchProducts(barcode, CANDIDATES), true);
    if (found.length) return { ...line, confidence: "barcode", candidates: found };
  }
  const shortCode = barcode ? null : normalizeShortCode(line.barcode);
  if (shortCode) {
    const found = toCandidates(await searchProducts(shortCode, CANDIDATES), true);
    if (found.length) {
      const confidence: Confidence = shortCodeIsCertain(line.printed, found) ? "barcode" : "loose";
      return { ...line, confidence, candidates: found };
    }
  }
  // 2. רק אם הקוד לא נמצא במאגר: לפי השם
  for (const variant of queryVariants(line)) {
    const found = toCandidates(await searchProducts(variant.query, CANDIDATES * 2), false);
    if (found.length) {
      const confidence: Confidence = variant.exact ? "name" : "loose";
      return { ...line, confidence, candidates: found };
    }
  }
  return { ...line, confidence: "none", candidates: [] };
}

/** התאמת כל שורה למוצרים במאגר: קודם לפי הקוד שהודפס, ורק אם לא נמצא – לפי שם. */
export async function matchLines(lines: ReceiptLine[]): Promise<MatchedLine[]> {
  const matched: MatchedLine[] = [];
  for (let i = 0; i < lines.length; i += 4) {
    matched.push(...(await Promise.all(lines.slice(i, i + 4).map(matchLine))));
  }
  return matched;
}
