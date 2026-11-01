import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { requireDatabaseUrl } from "@/lib/env";
import {
  delay,
  isRetriableRead,
  isTransientConnectionError,
  statementText,
} from "./retry";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

// Next.js can instantiate route chunks with separate copies of this module.
// Keeping the pool on globalThis guarantees one pool per server process.
const globalForDb = globalThis as unknown as {
  __dakostaPool?: Pool;
  __dakostaDb?: Db;
};

type QueryFn = Pool["query"];
type ConnectFn = Pool["connect"];

/**
 * Neon pooled endpoint memutus WebSocket tanpa pemberitahuan. Pembacaan
 * diulang sekali; penulisan dibiarkan gagal agar tidak terjadi efek ganda.
 */
function withConnectionRetry(pool: Pool) {
  const rawQuery = pool.query.bind(pool) as QueryFn;
  const rawConnect = pool.connect.bind(pool) as ConnectFn;

  pool.query = (async (...args: Parameters<QueryFn>) => {
    const retriable = isRetriableRead(statementText(args[0]));
    let lastError: unknown;
    for (let attempt = 0; attempt < (retriable ? 2 : 1); attempt += 1) {
      try {
        return await (rawQuery as (...a: unknown[]) => Promise<unknown>)(
          ...args,
        );
      } catch (error) {
        lastError = error;
        if (!retriable || !isTransientConnectionError(error)) throw error;
        await delay(50);
      }
    }
    throw lastError;
  }) as QueryFn;

  pool.connect = (async (...args: Parameters<ConnectFn>) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await (rawConnect as (...a: unknown[]) => Promise<unknown>)(
          ...args,
        );
      } catch (error) {
        lastError = error;
        if (!isTransientConnectionError(error)) throw error;
        await delay(100 * (attempt + 1));
      }
    }
    throw lastError;
  }) as ConnectFn;

  return pool;
}

function createDb(connectionString: string) {
  const configured = Number(process.env.DB_POOL_MAX);
  const max =
    Number.isInteger(configured) && configured > 0
      ? Math.min(configured, 50)
      : 3;
  const pool = withConnectionRetry(
    new Pool({
      connectionString,
      max,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 30_000,
      // Endpoint pooled menolak parameter startup `options`/`statement_timeout`
      // (08P01), jadi batas kueri dipasang di klien agar kueri menggantung
      // gagal cepat tanpa bergantung pada server.
      query_timeout: 15_000,
    }),
  );
  // Tanpa listener ini, galat klien diam menjadi uncaughtException.
  pool.on("error", (error: unknown) => {
    console.error(
      "[db] koneksi Neon terputus:",
      error instanceof Error ? error.message : "socket error",
    );
  });
  const db = drizzle(pool, { schema });
  globalForDb.__dakostaPool = pool;
  globalForDb.__dakostaDb = db;
  return db;
}

export function getDb(): Db {
  if (globalForDb.__dakostaDb) return globalForDb.__dakostaDb;
  return createDb(requireDatabaseUrl());
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function closeDb(): Promise<void> {
  const pool = globalForDb.__dakostaPool;
  if (pool) {
    await pool.end();
    globalForDb.__dakostaPool = undefined;
    globalForDb.__dakostaDb = undefined;
  }
}

export { schema };
