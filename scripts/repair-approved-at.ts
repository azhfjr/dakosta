import { and, count, eq, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
  resolveDbTarget,
} from "./_env";
import * as schema from "../src/db/schema";

async function main(): Promise<void> {
  const target = resolveDbTarget();
  loadScriptEnv(target);

  if (
    target === "production" &&
    process.env.REPAIR_CONFIRM !== "apply-production"
  ) {
    throw new Error(
      "Perbaikan production memerlukan REPAIR_CONFIRM=apply-production. Tidak ada perubahan yang dilakukan.",
    );
  }

  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });

  try {
    const db = drizzle(pool);
    const orphan = and(
      ne(schema.contentSubmissions.status, "APPROVED"),
      isNotNull(schema.contentSubmissions.approvedAt),
    );

    const [before] = await db
      .select({ value: count() })
      .from(schema.contentSubmissions)
      .where(orphan);
    const stale = Number(before?.value ?? 0);
    console.log(`${describeTarget(target)} orphan approved_at: ${stale}`);

    if (stale > 0) {
      const updated = await db
        .update(schema.contentSubmissions)
        .set({ approvedAt: null })
        .where(orphan)
        .returning({ id: schema.contentSubmissions.id });
      console.log(`Dibersihkan: ${updated.length}`);
    }

    const [after] = await db
      .select({ value: count() })
      .from(schema.contentSubmissions)
      .where(orphan);
    const remaining = Number(after?.value ?? 0);
    console.log(`Sisa orphan approved_at: ${remaining}`);
    if (remaining > 0)
      throw new Error("Masih ada approved_at pada status non-APPROVED.");

    const [approved] = await db
      .select({ value: count() })
      .from(schema.contentSubmissions)
      .where(
        and(
          eq(schema.contentSubmissions.status, "APPROVED"),
          eq(schema.contentSubmissions.archived, false),
        ),
      );
    console.log(`Disetujui aktif: ${Number(approved?.value ?? 0)}`);
    console.log("Selesai. Nilai rahasia tidak dicetak.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
