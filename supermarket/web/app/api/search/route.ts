import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ query: q, results: await searchProducts(q) });
}
