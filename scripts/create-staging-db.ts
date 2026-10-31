import { chmod, writeFile } from "node:fs/promises";

import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

const STAGING_DATABASE = "dakosta_staging";

function deriveUrl(base: string, databaseName: string): string {
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function main(): Promise<void> {
  const base = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const sourceUrl = new URL(base);
  if (sourceUrl.pathname === `/${STAGING_DATABASE}`) {
    console.log(`Database ${STAGING_DATABASE} sudah menjadi target saat ini.`);
    return;
  }

  const pool = new Pool({ connectionString: base, max: 1 });
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "select 1 from pg_database where datname = $1",
      [STAGING_DATABASE],
    );
    if (existing.rowCount === 0) {
      await client.query(`create database "${STAGING_DATABASE}"`);
      console.log(`Database ${STAGING_DATABASE} dibuat.`);
    } else {
      console.log(`Database ${STAGING_DATABASE} sudah ada.`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  const stagingUrl = deriveUrl(base, STAGING_DATABASE);
  const envFile = [
    "APP_ENV=staging",
    "DEMO_MODE=true",
    `DATABASE_URL=${stagingUrl}`,
    `DATABASE_URL_UNPOOLED=${stagingUrl}`,
    "",
  ].join("\n");
  await writeFile(".env.staging.local", envFile, "utf8");
  await chmod(".env.staging.local", 0o600).catch(() => undefined);
  console.log(
    "File .env.staging.local ditulis (gitignored). Nilai koneksi tidak dicetak.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
