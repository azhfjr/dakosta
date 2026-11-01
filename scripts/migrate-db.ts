import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
  resolveDbTarget,
} from "./_env";

async function main(): Promise<void> {
  const target = resolveDbTarget();
  loadScriptEnv(target);

  if (
    target === "production" &&
    process.env.MIGRATE_CONFIRM !== "apply-production"
  ) {
    throw new Error(
      "Migrasi production memerlukan MIGRATE_CONFIRM=apply-production. Tidak ada perubahan yang dilakukan.",
    );
  }

  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });

  try {
    const db = drizzle(pool);
    console.log(`Menjalankan migrasi Drizzle (${describeTarget(target)}).`);
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrasi selesai.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
