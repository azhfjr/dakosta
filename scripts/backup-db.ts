import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";
import { loadScriptEnv } from "./_env";

loadScriptEnv();

type ColumnInfo = {
  column_name: string;
  data_type: string;
  udt_name: string;
};

function targetFromArgs(): string {
  const arg = process.argv.find((value) => value.startsWith("--target="));
  const value = arg?.split("=")[1];
  return value && /^[a-z0-9_-]+$/i.test(value) ? value : "local";
}

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const target = targetFromArgs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = join(process.cwd(), "backups", `${stamp}-${target}`);
  await mkdir(directory, { recursive: true });

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    const tablesResult = await client.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
          and table_name <> '__drizzle_migrations'
        order by table_name`,
    );

    const manifest: {
      target: string;
      exportedAt: string;
      databaseVersion: string | null;
      tables: Array<{
        table: string;
        columns: ColumnInfo[];
        rowCount: number;
        sha256: string;
        file: string;
      }>;
    } = {
      target,
      exportedAt: new Date().toISOString(),
      databaseVersion: null,
      tables: [],
    };

    const version = await client.query<{ version: string }>(
      "select version() as version",
    );
    manifest.databaseVersion = version.rows[0]?.version ?? null;

    for (const { table_name: table } of tablesResult.rows) {
      const columnsResult = await client.query<ColumnInfo>(
        `select column_name, data_type, udt_name
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [table],
      );
      const rowsResult = await client.query(
        `select * from "${table.replaceAll('"', '""')}"`,
      );
      const json = JSON.stringify(rowsResult.rows);
      const digest = createHash("sha256").update(json).digest("hex");
      const file = `${table.replaceAll("/", "_")}.ndjson`;
      await writeFile(join(directory, file), `{"rows":${json}}`, "utf8");
      manifest.tables.push({
        table,
        columns: columnsResult.rows,
        rowCount: rowsResult.rows.length,
        sha256: digest,
        file,
      });
      console.log(`${table}: ${rowsResult.rows.length} baris`);
    }

    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    console.log(`Backup logis selesai di ${directory}`);
    console.log(`Target: ${target}. Tidak ada nilai rahasia yang dicetak.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
