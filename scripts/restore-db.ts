import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Pool } from "@neondatabase/serverless";
import { loadScriptEnv } from "./_env";

loadScriptEnv();

type ColumnInfo = {
  column_name: string;
  data_type: string;
  udt_name: string;
};

type Manifest = {
  target: string;
  exportedAt: string;
  tables: Array<{
    table: string;
    columns: ColumnInfo[];
    rowCount: number;
    file: string;
  }>;
};

const INSERT_ORDER = [
  "regional_offices",
  "branch_offices",
  "stakeholders",
  "user",
  "account",
  "session",
  "verification",
  "user_profiles",
  "user_role_memberships",
  "user_stakeholder_memberships",
  "user_memberships",
  "account_invitations",
  "organization_transfers",
  "themes",
  "edufast_monthly_policies",
  "edufast_policy_subthemes",
  "edufast_policy_events",
  "locations",
  "content_submissions",
  "content_revisions",
  "content_reviews",
  "kpi_targets",
  "notifications",
  "outbox_events",
  "audit_logs",
  "account_imports",
  "account_import_rows",
  "migration_runs",
  "rate_limits",
  "demo_rate_limits",
];

function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function orderedTables(tables: Manifest["tables"]): Manifest["tables"] {
  const rank = new Map(INSERT_ORDER.map((name, index) => [name, index]));
  return [...tables].sort((a, b) => {
    const left = rank.get(a.table) ?? 10_000;
    const right = rank.get(b.table) ?? 10_000;
    return left === right ? a.table.localeCompare(b.table) : left - right;
  });
}

function normalizeValue(value: unknown, column: ColumnInfo): unknown {
  if (value === null || value === undefined) return null;
  if (column.data_type === "jsonb" || column.data_type === "json") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.RESTORE_CONFIRM !== "restore") {
    throw new Error(
      "Restore memerlukan RESTORE_CONFIRM=restore. Tidak ada perubahan yang dilakukan.",
    );
  }
  if (
    (process.env.APP_ENV === "production" ||
      process.env.VERCEL_ENV === "production") &&
    process.env.ALLOW_PRODUCTION_RESTORE !== "yes"
  ) {
    throw new Error(
      "Restore ke production memerlukan ALLOW_PRODUCTION_RESTORE=yes.",
    );
  }

  const directory = process.argv.find((value) => value.startsWith("--dir="))
    ?.split("=")[1];
  if (!directory) throw new Error("Gunakan --dir=backups/<nama-backup>.");

  const manifestPath = resolve(directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  if (!Array.isArray(manifest.tables)) {
    throw new Error("Manifest backup tidak valid.");
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    const database = await client.query<{ db: string }>(
      "select current_database() as db",
    );
    console.log(`Restore ke database: ${database.rows[0]?.db ?? "unknown"}`);

    await client.query("begin");
    const truncateList = orderedTables(manifest.tables)
      .map((entry) => quote(entry.table))
      .join(", ");
    if (truncateList) {
      await client.query(`truncate table ${truncateList} restart identity cascade`);
    }

    for (const entry of orderedTables(manifest.tables)) {
      const payload = JSON.parse(
        await readFile(join(directory, entry.file), "utf8"),
      ) as { rows: Record<string, unknown>[] };
      const rows = payload.rows ?? [];
      if (rows.length === 0) {
        console.log(`${entry.table}: 0 baris`);
        continue;
      }

      const columns = entry.columns.map((column) => column.column_name);
      const columnSql = columns.map(quote).join(", ");
      const batchSize = 200;

      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values: unknown[] = [];
        const tuples = batch.map((row) => {
          const placeholders = entry.columns.map((column) => {
            values.push(normalizeValue(row[column.column_name], column));
            return `$${values.length}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        await client.query(
          `insert into ${quote(entry.table)} (${columnSql}) values ${tuples.join(", ")}`,
          values,
        );
      }
      console.log(`${entry.table}: ${rows.length} baris`);
    }

    await client.query("commit");
    console.log("Restore selesai. Verifikasi jumlah baris terhadap manifest.");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
