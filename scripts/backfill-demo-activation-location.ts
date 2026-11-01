import { loadScriptEnv } from "./_env";

const target = loadScriptEnv();

import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";

function arg(name: string, fallback?: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

type Candidate = {
  id: string;
  location_status: string;
  latitude: number | null;
  longitude: number | null;
  existing_source: string | null;
};

async function main(): Promise<void> {
  const confirm = arg("confirm");
  const dryRun = process.argv.includes("--dry-run");
  if (target !== "production") {
    throw new Error(
      "Backfill demo hanya untuk --target=production. Tidak ada perubahan yang dilakukan.",
    );
  }
  if (confirm !== "demo-only") {
    throw new Error(
      "Tambahkan --confirm=demo-only. Backfill menolak berjalan tanpa konfirmasi eksplisit.",
    );
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
  const pool = new Pool({ connectionString, max: 2 });
  const db = drizzle(pool, { schema });

  try {
    const candidates = await pool.query<Candidate>(
      `select u.id,
              up.location_status,
              coalesce(
                (select s.latitude from stakeholders s where s.id = m.organization_id),
                (select s.latitude from stakeholders s where s.branch_office_id = m.branch_office_id order by s.name limit 1),
                (select s.latitude from stakeholders s
                   join branch_offices b on b.id = s.branch_office_id
                  where b.regional_office_id = m.regional_office_id
                  order by s.name limit 1),
                (select s.latitude from stakeholders s order by s.name limit 1)
              ) as latitude,
              coalesce(
                (select s.longitude from stakeholders s where s.id = m.organization_id),
                (select s.longitude from stakeholders s where s.branch_office_id = m.branch_office_id order by s.name limit 1),
                (select s.longitude from stakeholders s
                   join branch_offices b on b.id = s.branch_office_id
                  where b.regional_office_id = m.regional_office_id
                  order by s.name limit 1),
                (select s.longitude from stakeholders s order by s.name limit 1)
              ) as longitude,
              (select l.source from user_activation_locations l where l.user_id = u.id) as existing_source
         from "user" u
         join user_profiles up on up.user_id = u.id
         left join user_memberships m on m.user_id = u.id and m.revoked_at is null
        where up.is_demo = true
          and up.active = true
          and up.location_status <> 'EXEMPT'
        order by u.id`,
    );

    const pending = candidates.rows.filter(
      (row) =>
        row.existing_source === null &&
        row.latitude !== null &&
        row.longitude !== null,
    );
    const skipped = candidates.rows.filter(
      (row) =>
        row.existing_source !== null ||
        row.latitude === null ||
        row.longitude === null,
    );

    console.log(
      `Akun demo kandidat: ${candidates.rows.length}; akan diisi: ${pending.length}; dilewati (sudah punya lokasi/koordinat tidak tersedia): ${skipped.length}.`,
    );
    if (dryRun) {
      console.log("Mode --dry-run: tidak ada perubahan yang ditulis.");
      return;
    }

    let inserted = 0;
    for (const row of pending) {
      const consentAt = new Date();
      await db
        .insert(schema.userActivationLocations)
        .values({
          userId: row.id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          accuracyMeters: 100,
          source: "demo_backfill",
          distanceMeters: null,
          reviewFlag: false,
          consentAt,
        })
        .onConflictDoNothing();
      await db
        .update(schema.userProfiles)
        .set({
          locationStatus: "VERIFIED",
          locationGraceDeadline: null,
          updatedAt: consentAt,
        })
        .where(
          sql`${schema.userProfiles.userId} = ${row.id} and ${schema.userProfiles.isDemo} = true`,
        );
      inserted += 1;
    }

    if (inserted > 0) {
      await db.insert(schema.auditLogs).values({
        actorId: null,
        actorRole: "SYSTEM",
        action: "LOCATION_DEMO_BACKFILL",
        recordType: "USER",
        recordId: "demo-accounts",
        after: {
          users: inserted,
          source: "demo_backfill",
          note: "Koordinat instansi sintetis; bukan klaim GPS perangkat.",
        },
        source: "SCRIPT",
      });
    }
    console.log(
      `Selesai: ${inserted} akun demo diisi lokasi sintetis (demo_backfill), status VERIFIED.`,
    );
    console.log(
      "Akun non-demo tidak disentuh. Tidak ada koordinat pengguna nyata yang dibaca atau dicetak.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
