import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { searchProducts } from "./search";
import {
  normalizeBarcode,
  queryVariants,
  type Candidate,
  type Confidence,
  type MatchedLine,
  type ReceiptLine,
} from "./receipt-match";

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export const receiptEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const isSupportedType = (type: string) => type === "application/pdf" || IMAGE_TYPES.includes(type as ImageType);

/** שגיאה עם הודעה שמותר להציג למשתמש */
export class ReceiptError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          printed: { type: "string", description: "The product name exactly as printed on the receipt" },
          name: {
            type: "string",
            description:
              "Best guess of the full Hebrew product name as it appears on a supermarket shelf label: abbreviations spelled out, brand included, size kept (e.g. 'חלב תנובה 3% 1 ליטר')",
          },
          barcode: { type: ["string", "null"], description: "The item barcode digits if printed next to the item, else null" },
          unit: { type: "string", enum: ["unit", "kg"], description: "'kg' for items sold by weight, else 'unit'" },
          quantity: { type: "number", description: "Number of units, or the weight in kg when unit is 'kg'" },
          total: { type: ["number", "null"], description: "Amount paid for the line in shekels, if printed" },
        },
        required: ["printed", "name", "barcode", "unit", "quantity", "total"],
        additionalProperties: false,
      },
    },
  },
  required: ["lines"],
  additionalProperties: false,
} as const;

const INSTRUCTIONS = `This is a receipt from an Israeli supermarket (a photo, a scan or a digital receipt). \
The products on it will be added to a family shopping list in a price-comparison app, so list every purchased product, one entry per product.

Receipts print a product on one line and often put its quantity, weight, unit price or barcode on the line above or below it; fold those into the product's entry. \
When the same product appears on several lines, return one entry with the summed quantity.

Leave out everything that is not a product someone would put on a shopping list: discounts and promotion lines, bottle deposits (פיקדון), carrier bags, delivery fees, \
subtotals, totals, VAT, payment and change lines, loyalty-club and coupon lines, and store details. Skip a line you cannot read rather than guessing a product.

If the document is not a receipt or has no readable products, return an empty list.`;

/** קריאת החשבונית בעזרת Claude: מחזיר את שורות המוצרים שבה. */
export async function readReceipt(data: Buffer, mediaType: string): Promise<ReceiptLine[]> {
  const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
  const base64 = data.toString("base64");
  const file: Anthropic.Beta.BetaContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType as ImageType, data: base64 } };

  let response;
  try {
    response = await client.beta.messages.parse({
      model: process.env.RECEIPT_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      // אם המודל מסרב לבקשה, השרת מריץ אותה שוב על מודל חלופי באותה קריאה
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaJSONSchemaOutputFormat(SCHEMA) },
      messages: [{ role: "user", content: [file, { type: "text", text: INSTRUCTIONS }] }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ReceiptError("מפתח ה-API של Claude אינו תקין. בודקים את ANTHROPIC_API_KEY בקובץ ‎.env בשרת.", 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ReceiptError("שירות הקריאה עמוס כרגע. מנסים שוב בעוד דקה.", 503);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("receipt: bad request", error.message);
      throw new ReceiptError("לא הצלחנו לקרוא את הקובץ. מנסים צילום אחר, חד ומואר.", 422);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("receipt: api error", error.status, error.message);
      throw new ReceiptError("קריאת החשבונית נכשלה. מנסים שוב בעוד רגע.");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") throw new ReceiptError("לא ניתן לקרוא את הקובץ הזה.", 422);
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new ReceiptError("החשבונית ארוכה מדי לקריאה בבת אחת. מצלמים אותה בשני חלקים.", 422);
  }
  return response.parsed_output.lines
    .map((line) => ({ ...line, printed: line.printed.trim().slice(0, 120), name: line.name.trim().slice(0, 120) }))
    .filter((line) => line.printed || line.name)
    .slice(0, 150);
}

const CANDIDATES = 5;

async function matchLine(line: ReceiptLine): Promise<MatchedLine> {
  const toCandidates = (products: Awaited<ReturnType<typeof searchProducts>>): Candidate[] =>
    products
      .filter((p) => !p.internal)
      .slice(0, CANDIDATES)
      .map((p) => ({
        id: p.id,
        name: p.name,
        manufacturer: p.manufacturer,
        isWeighted: p.isWeighted,
        minPrice: p.prices.length ? Math.min(...p.prices.map((x) => Number(x.price))) : null,
      }));

  const barcode = normalizeBarcode(line.barcode);
  if (barcode) {
    const found = toCandidates(await searchProducts(barcode, CANDIDATES));
    if (found.length) return { ...line, confidence: "barcode", candidates: found };
  }
  for (const variant of queryVariants(line)) {
    const found = toCandidates(await searchProducts(variant.query, CANDIDATES * 2));
    if (found.length) {
      const confidence: Confidence = variant.exact ? "name" : "loose";
      return { ...line, confidence, candidates: found };
    }
  }
  return { ...line, confidence: "none", candidates: [] };
}

/** התאמת כל שורה למוצרים במאגר: לפי ברקוד אם הודפס, אחרת לפי שם. */
export async function matchLines(lines: ReceiptLine[]): Promise<MatchedLine[]> {
  const matched: MatchedLine[] = [];
  for (let i = 0; i < lines.length; i += 4) {
    matched.push(...(await Promise.all(lines.slice(i, i + 4).map(matchLine))));
  }
  return matched;
}
