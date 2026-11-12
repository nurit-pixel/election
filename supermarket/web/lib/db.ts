import "server-only";
import { Pool } from "pg";

// Pool יחיד לכל התהליך (גם ב-hot reload של סביבת הפיתוח)
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;
