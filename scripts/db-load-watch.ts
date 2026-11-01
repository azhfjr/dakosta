import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";

import { loadScriptEnv } from "./_env";

const target = loadScriptEnv();

function arg(name: string, fallback?: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

function seconds(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^(\d+)(s|m)$/.exec(value.trim());
  if (!match) throw new Error(`Durasi tidak valid: ${value}`);
  return Number(match[1]) * (match[2] === "m" ? 60 : 1);
}

async function main(): Promise<void> {
  if (target !== "staging" || process.env.APP_ENV !== "staging") {
    throw new Error(
      "Pemantauan beban hanya dijalankan pada --target=staging dengan APP_ENV=staging.",
    );
  }
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const durationSeconds = seconds(arg("duration"), 900);
  const intervalSeconds = seconds(arg("interval"), 5);
  const pool = new Pool({ connectionString, max: 1 });
  const samples: Array<{
    at: string;
    total: number;
    active: number;
    idle: number;
    idleInTransaction: number;
    waiting: number;
    maxConnections: number;
    xactCommit: number;
    blksRead: number;
  }> = [];

  try {
    const started = performance.now();
    while ((performance.now() - started) / 1000 < durationSeconds) {
      const [activity, database] = await Promise.all([
        pool.query<{
          total: string;
          active: string;
          idle: string;
          idle_in_transaction: string;
          waiting: string;
          max_connections: string;
        }>(
          `select count(*)::text as total,
                  count(*) filter (where state = 'active')::text as active,
                  count(*) filter (where state = 'idle')::text as idle,
                  count(*) filter (where state = 'idle in transaction')::text as idle_in_transaction,
                  count(*) filter (where wait_event_type is not null)::text as waiting,
                  current_setting('max_connections') as max_connections
             from pg_stat_activity
            where datname = current_database()`,
        ),
        pool.query<{ xact_commit: string; blks_read: string }>(
          `select xact_commit::text, blks_read::text
             from pg_stat_database
            where datname = current_database()`,
        ),
      ]);
      const row = activity.rows[0];
      const sample = {
        at: new Date().toISOString(),
        total: Number(row?.total ?? 0),
        active: Number(row?.active ?? 0),
        idle: Number(row?.idle ?? 0),
        idleInTransaction: Number(row?.idle_in_transaction ?? 0),
        waiting: Number(row?.waiting ?? 0),
        maxConnections: Number(row?.max_connections ?? 0),
        xactCommit: Number(database.rows[0]?.xact_commit ?? 0),
        blksRead: Number(database.rows[0]?.blks_read ?? 0),
      };
      samples.push(sample);
      console.log(
        `${sample.at} koneksi ${sample.total}/${sample.maxConnections} (active ${sample.active}, idle ${sample.idle}, idle-in-tx ${sample.idleInTransaction}), menunggu ${sample.waiting}.`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, intervalSeconds * 1000),
      );
    }

    mkdirSync(join("docs", "audit", "evidence"), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join("docs", "audit", "evidence", `E-db-watch-${stamp}.json`);
    const maxConnections = Math.max(
      ...samples.map((sample) => sample.total),
      0,
    );
    const maxActive = Math.max(...samples.map((sample) => sample.active), 0);
    const idleInTransaction = Math.max(
      ...samples.map((sample) => sample.idleInTransaction),
      0,
    );
    writeFileSync(
      file,
      JSON.stringify(
        {
          target: "staging",
          generatedAt: new Date().toISOString(),
          durationSeconds,
          intervalSeconds,
          maxConnectionsObserved: maxConnections,
          maxActiveObserved: maxActive,
          maxIdleInTransaction: idleInTransaction,
          samples,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(
      `Ringkasan: maksimum koneksi ${maxConnections}, active ${maxActive}, idle-in-tx ${idleInTransaction}.`,
    );
    console.log(`Evidence: ${file}`);
    if (idleInTransaction > 0) {
      console.error(
        "PERINGATAN: ada transaksi idle-in-transaction selama beban.",
      );
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
