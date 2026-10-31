import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { requireDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

let pool: Pool | undefined;
let db: Db | undefined;

function createDb(connectionString: string) {
  pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  return drizzle(pool, { schema });
}

export function getDb(): Db {
  if (db) return db;
  db = createDb(requireDatabaseUrl());
  return db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

export { schema };
