import { Pool } from "@neondatabase/serverless";

import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
  resolveDbTarget,
} from "./_env";

const CANONICAL = new Set([
  "DRAFT",
  "SUBMITTED",
  "REVISION_REQUIRED",
  "APPROVED",
]);

async function main(): Promise<void> {
  const target = resolveDbTarget();
  loadScriptEnv(target);
  const strict = process.argv.includes("--strict");
  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });

  try {
    const { rows } = await pool.query<{
      status: string;
      archived: boolean;
      total: number;
      with_approved_at: number;
    }>(
      `select status, archived, count(*)::int as total,
              count(*) filter (where approved_at is not null)::int as with_approved_at
         from content_submissions
        group by status, archived
        order by status, archived`,
    );

    console.log(`Census status konten (${describeTarget(target)}).`);
    let total = 0;
    let legacy = 0;
    let approvedActive = 0;
    for (const row of rows) {
      total += row.total;
      if (!CANONICAL.has(row.status)) legacy += row.total;
      if (row.status === "APPROVED" && !row.archived)
        approvedActive += row.total;
      console.log(
        `${row.status}\tarchived=${row.archived}\trows=${row.total}\tapproved_at=${row.with_approved_at}`,
      );
    }
    console.log(`Total baris: ${total}`);
    console.log(`Baris legacy: ${legacy}`);
    console.log(
      `Disetujui aktif (approved, tidak diarsipkan): ${approvedActive}`,
    );

    if (strict && legacy > 0) {
      throw new Error(
        `Census gagal: masih ada ${legacy} baris dengan status di luar kontrak 4 nilai.`,
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
