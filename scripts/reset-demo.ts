import { assertDestructiveTargetAllowed, loadScriptEnv } from "./_env";

const scriptTarget = loadScriptEnv();
assertDestructiveTargetAllowed(scriptTarget, "Reset demo");

import { sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "../src/db/schema";
import { runSeed } from "./seed";

type SeedDb = NeonDatabase<typeof schema>;

const TABLES_IN_DELETE_ORDER = [
  "outbox_events",
  "notifications",
  "content_reviews",
  "content_revisions",
  "content_submissions",
  "kpi_targets",
  "locations",
  "account_import_rows",
  "account_imports",
  "account_invitations",
  "edufast_policy_events",
  "edufast_policy_subthemes",
  "edufast_monthly_policies",
  "organization_transfers",
  "user_stakeholder_memberships",
  "user_memberships",
  "user_role_memberships",
  "stakeholders",
  "themes",
  "branch_offices",
  "regional_offices",
  "user_profiles",
  "audit_logs",
  "demo_rate_limits",
  "rate_limits",
  "migration_runs",
  "session",
  "account",
  "verification",
  '"user"',
] as const;

async function resetDemo(db: SeedDb): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.execute(sql.raw(`delete from ${table}`));
  }
  console.log("Data demo lama dihapus.");
  await runSeed(db);
  console.log("Data demo berhasil dipulihkan ke kondisi awal.");
}

async function main(): Promise<void> {
  const runtimeEnv = process.env.APP_ENV ?? process.env.VERCEL_ENV;
  if (runtimeEnv === "production") {
    throw new Error(
      "Reset demo dilarang di production. Tidak ada perubahan yang dilakukan.",
    );
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    await resetDemo(db);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
