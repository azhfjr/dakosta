import { Pool } from "@neondatabase/serverless";

import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
  resolveDbTarget,
} from "./_env";

const target = resolveDbTarget();
loadScriptEnv(target);

const KEY_TABLES = [
  "user",
  "account",
  "user_profiles",
  "user_memberships",
  "user_role_memberships",
  "regional_offices",
  "branch_offices",
  "stakeholders",
  "themes",
  "kpi_targets",
  "content_submissions",
  "content_revisions",
  "content_reviews",
  "edufast_monthly_policies",
  "edufast_policy_subthemes",
  "edufast_policy_events",
  "account_imports",
  "account_import_rows",
  "account_invitations",
  "organization_transfers",
  "notifications",
  "outbox_events",
  "audit_logs",
  "rate_limits",
  "demo_rate_limits",
  "migration_runs",
  "session",
] as const;

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });
  try {
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const existing = new Set(tables.rows.map((row) => row.table_name));

    console.log(`Inventaris basis data (${describeTarget(target)}).`);

    const migrations = await pool
      .query<{ total: string }>(
        `select count(*)::text as total from drizzle.__drizzle_migrations`,
      )
      .catch(() => ({ rows: [{ total: "n/a" }] }));
    console.log(`migrasi_tercatat=${migrations.rows[0]?.total ?? "n/a"}`);

    for (const table of KEY_TABLES) {
      const quoted = `"${table}"`;
      if (!existing.has(table)) {
        console.log(`${table}=tidak_ada`);
        continue;
      }
      const hasDemoFlag = [
        "user_profiles",
        "stakeholders",
        "content_submissions",
      ].includes(table);
      const result = await pool.query<{ total: string; demo: string | null }>(
        hasDemoFlag
          ? `select count(*)::text as total, count(*) filter (where is_demo)::text as demo from ${quoted}`
          : `select count(*)::text as total, null::text as demo from ${quoted}`,
      );
      const row = result.rows[0];
      console.log(
        row?.demo === null || row?.demo === undefined
          ? `${table}=${row?.total}`
          : `${table}=${row?.total} demo=${row.demo}`,
      );
    }

    if (existing.has("user_memberships") && existing.has("user_profiles")) {
      const roles = await pool.query<{ role: string; total: string }>(
        `select m.role, count(*)::text as total
           from user_memberships m
           join user_profiles p on p.user_id = m.user_id
          where m.revoked_at is null
          group by m.role
          order by m.role`,
      );
      console.log(
        `peran_aktif=${roles.rows.map((row) => `${row.role}:${row.total}`).join(",") || "kosong"}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
