import { sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "../src/db/schema";
import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
} from "./_env";

const target = process.argv
  .find((value) => value.startsWith("--target="))
  ?.split("=")[1];
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
  "user",
] as const;

const DEMO_FLAG_TABLES = [
  "user_profiles",
  "stakeholders",
  "content_submissions",
] as const;

function quoted(table: string): string {
  return `"${table.replaceAll('"', '""')}"`;
}

async function purgeResidualDemoUsers(
  pool: Pool,
  db: NeonDatabase<typeof schema>,
): Promise<void> {
  const residual = await pool.query<{ id: string; email: string }>(
    `select u.id, u.email
       from "user" u
      where u.email like '%@demo.dakosta.local'
        and not exists (select 1 from user_profiles p where p.user_id = u.id)
        and not exists (select 1 from account a where a.user_id = u.id)
        and not exists (select 1 from user_memberships m where m.user_id = u.id)
        and not exists (select 1 from user_role_memberships r where r.user_id = u.id)`,
  );

  if (residual.rows.length === 0) {
    console.log("Tidak ada pengguna demo yatim. Tidak ada perubahan.");
    return;
  }

  const startedAt = new Date();
  for (const row of residual.rows) {
    await pool.query(`delete from "user" where id = $1`, [row.id]);
  }

  await db.insert(schema.migrationRuns).values({
    name: "purge-demo-production-residual-users",
    targetEnv: "production",
    startedAt,
    finishedAt: new Date(),
    counts: { users: residual.rows.length },
    notes:
      "Perbaikan sisa pengguna demo tanpa profil/akun/membership setelah purge awal.",
  });

  console.log(`Pengguna demo yatim dihapus: ${residual.rows.length}.`);
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });
  const db = drizzle(pool, { schema });

  try {
    if (process.env.PURGE_SCOPE === "residual-demo-users") {
      await purgeResidualDemoUsers(pool, db);
      return;
    }

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
      const result = await pool.query<{ total: string }>(
        `select count(*)::text as total from ${quoted(table)}`,
      );
      counts[table] = Number(result.rows[0]?.total ?? "0");
    }

    const startedAt = new Date();
    for (const table of DELETE_ORDER) {
      if (!existing.has(table)) continue;
      await db.execute(sql.raw(`delete from ${quoted(table)}`));
    }

    const totalRows = Object.values(counts).reduce(
      (sum, value) => sum + value,
      0,
    );
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
    console.log(
      `Baris dihapus: ${totalRows}. Rekap tersimpan di migration_runs.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
