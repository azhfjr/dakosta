import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import { isProtectedAccountEmail } from "../src/lib/authz/protected-accounts";
import { loadScriptEnv, requireDatabaseUrlForScript } from "./_env";
import {
  assertInvariantsPreserved,
  collectDemoScope,
  purgeDemoOnly,
  snapshotInvariants,
} from "./demo-purge";

const args = process.argv.slice(2);
const target = args.find((value) => value.startsWith("--target="))?.split("=")[1];
const dryRun = args.includes("--dry-run");

function refuse(message: string): never {
  throw new Error(`${message} Tidak ada perubahan yang dilakukan.`);
}

if (target !== "production") {
  refuse("Purge demo hanya boleh dijalankan dengan --target=production.");
}

loadScriptEnv("production");

if (process.env.PURGE_DEMO_CONFIRM !== "purge-demo-only") {
  refuse("Purge demo memerlukan PURGE_DEMO_CONFIRM=purge-demo-only.");
}

const scope = collectDemoScope();
for (const email of scope.emails) {
  if (isProtectedAccountEmail(email)) {
    refuse(`Email terlindungi ${email} masuk ke scope demo.`);
  }
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });
  const db = drizzle(pool, { schema });

  try {
    const before = await snapshotInvariants(db);
    console.log(
      `scope: akun=${scope.userIds.length} wilayah=${scope.regionIds.length} cabang=${scope.branchIds.length} organisasi=${scope.stakeholderIds.length} konten=${scope.submissionIds.length}`,
    );
    console.log(
      `rencana hapus: lokasi=${scope.locationIds.length} revisi=${scope.revisionIds.length} ulasan=${scope.reviewIds.length} target=${scope.targetIds.length} notifikasi=${scope.notificationIds.length} outbox=${scope.outboxIds.length} audit=${scope.auditIds.length}`,
    );
    console.log(
      `pending non-demo sebelum: profil=${before.nonDemoProfiles} stakeholder=${before.nonDemoStakeholders} konten=${before.nonDemoSubmissions} wilayah=${before.nonDemoRegions} cabang=${before.nonDemoBranches}`,
    );

    if (dryRun) {
      console.log("Dry run selesai. Tidak ada baris yang dihapus.");
      return;
    }

    await db.transaction(async (tx) => {
      const lock = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('dakosta.demo.seed.production')) as locked`,
      );
      if (lock.rows[0]?.locked !== true) {
        throw new Error(
          "Seed/purge demo lain sedang berjalan (advisory lock gagal). Transaksi dibatalkan.",
        );
      }

      await purgeDemoOnly(tx, scope);
      const after = await snapshotInvariants(tx);
      assertInvariantsPreserved(before, after);
    });

    const after = await snapshotInvariants(db);
    assertInvariantsPreserved(before, after);
    console.log("Purge demo selesai. Baris non-demo tidak berubah.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
