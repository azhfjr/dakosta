import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "../src/db/schema";
import { describeTarget, loadScriptEnv, requireDatabaseUrlForScript } from "./_env";

const target = process.argv.find((value) => value.startsWith("--target="))?.split("=")[1];
if (target !== "production") {
  throw new Error(
    "Purge demo hanya boleh dijalankan dengan --target=production. Tidak ada perubahan yang dilakukan.",
  );
}

loadScriptEnv("production");

if (process.env.PURGE_CONFIRM !== "purge-demo-data") {
  throw new Error(
    "Purge demo memerlukan PURGE_CONFIRM=purge-demo-data. Tidak ada perubahan yang dilakukan.",
  );
}

const DELETE_ORDER = [
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
  "session",
  "account",
  "verification",
  '"user"',
] as const;

const DEMO_FLAG_TABLES = ["user_profiles", "stakeholders", "content_submissions"] as const;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: requireDatabaseUrlForScript(), max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const tablesResult = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const existing = new Set(tablesResult.rows.map((row) => row.table_name));

    const blocked: string[] = [];
    for (const table of DEMO_FLAG_TABLES) {
      if (!existing.has(table)) continue;
      const result = await pool.query<{ total: string }>(
        `select count(*)::text as total from "${table}" where is_demo = false`,
      );
      const total = Number(result.rows[0]?.total ?? "0");
      if (total > 0) blocked.push(`${table}=${total}`);
    }

    if (blocked.length > 0) {
      throw new Error(
        `Purge dibatalkan: ditemukan data non-demo (${blocked.join(", ")}). Tidak ada perubahan yang dilakukan.`,
      );
    }

    const counts: Record<string, number> = {};
    for (const table of DELETE_ORDER) {
      if (!existing.has(table)) continue;
      const name = table.replaceAll('"', "");
      const result = await pool.query<{ total: string }>(
        `select count(*)::text as total from ${table}`,
      );
      counts[name] = Number(result.rows[0]?.total ?? "0");
    }

    const startedAt = new Date();
    for (const table of DELETE_ORDER) {
      if (!existing.has(table)) continue;
      await db.execute(sql.raw(`delete from ${table}`));
    }

    const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (existing.has("migration_runs")) {
      await db.insert(schema.migrationRuns).values({
        name: "purge-demo-production",
        targetEnv: "production",
        startedAt,
        finishedAt: new Date(),
        counts,
        notes: `Purge data demo terverifikasi (semua is_demo=true). Total baris dihapus: ${totalRows}.`,
      });
    }

    console.log(`Purge demo selesai (${describeTarget("production")}).`);
    console.log(`Baris dihapus: ${totalRows}. Rekap tersimpan di migration_runs.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
