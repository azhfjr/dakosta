import { loadScriptEnv, resolveDbTarget } from "./_env";

loadScriptEnv();

import { createHash } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import { LEGACY_THEME_TO_SUBTHEME, type SubTheme } from "../src/lib/taxonomy";

const TARGET = resolveDbTarget();

function requireConfirmation(): void {
  if (TARGET === "production" && process.env.MIGRATION_CONFIRM !== "yes") {
    throw new Error(
      "Backfill production memerlukan MIGRATION_CONFIRM=yes. Tidak ada perubahan yang dilakukan.",
    );
  }
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function mapTheme(slug: string | null, name: string | null): SubTheme {
  const candidates = [slug, name]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSlug);
  for (const candidate of candidates) {
    const mapped = LEGACY_THEME_TO_SUBTHEME[candidate];
    if (mapped) return mapped;
  }
  return "INFORMASI";
}

async function main(): Promise<void> {
  requireConfirmation();
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum dikonfigurasi untuk target ini.");

  console.log(`Backfill v4 (target=${TARGET} app_env=${process.env.APP_ENV ?? "(derived)"}).`);
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const startedAt = new Date();

    const legacyRows = await db
      .select({
        id: schema.contentSubmissions.id,
        mainTheme: schema.contentSubmissions.mainTheme,
        themeSlug: schema.themes.slug,
        themeName: schema.themes.name,
      })
      .from(schema.contentSubmissions)
      .leftJoin(schema.themes, eq(schema.themes.id, schema.contentSubmissions.themeId))
      .where(isNull(schema.contentSubmissions.mainTheme));

    const unresolved: Array<{ id: string; theme: string | null }> = [];
    let updated = 0;

    for (const row of legacyRows) {
      const known =
        (row.themeSlug && LEGACY_THEME_TO_SUBTHEME[normalizeSlug(row.themeSlug)]) ||
        (row.themeName && LEGACY_THEME_TO_SUBTHEME[normalizeSlug(row.themeName)]);
      if (!known) {
        unresolved.push({
          id: row.id,
          theme: row.themeSlug ?? row.themeName ?? null,
        });
      }
      const subTheme = mapTheme(row.themeSlug, row.themeName);
      await db
        .update(schema.contentSubmissions)
        .set({
          // Historical content is never inferred as EDUFAST.
          mainTheme: "NON_EDUFAST",
          subTheme,
          updatedAt: new Date(),
        })
        .where(eq(schema.contentSubmissions.id, row.id));
      updated += 1;
    }

    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        edufast: sql<number>`count(*) filter (where ${schema.contentSubmissions.mainTheme} = 'EDUFAST')::int`,
        nonEdufast: sql<number>`count(*) filter (where ${schema.contentSubmissions.mainTheme} = 'NON_EDUFAST')::int`,
        unmapped: sql<number>`count(*) filter (where ${schema.contentSubmissions.mainTheme} is null)::int`,
      })
      .from(schema.contentSubmissions);

    const legacyAdmins = await db
      .select({ userId: schema.userRoleMemberships.userId })
      .from(schema.userRoleMemberships)
      .where(eq(schema.userRoleMemberships.role, "ADMIN"));

    let promoted = 0;
    for (const admin of legacyAdmins) {
      const [existing] = await db
        .select({ id: schema.userMemberships.id })
        .from(schema.userMemberships)
        .where(
          and(
            eq(schema.userMemberships.userId, admin.userId),
            isNull(schema.userMemberships.revokedAt),
          ),
        )
        .limit(1);
      if (existing) continue;
      await db.insert(schema.userMemberships).values({
        userId: admin.userId,
        role: "MASTER_ADMIN",
      });
      promoted += 1;
    }

    const checksum = createHash("sha256")
      .update(JSON.stringify({ counts, updated, promoted, unresolved }))
      .digest("hex");

    await db.insert(schema.migrationRuns).values({
      name: "backfill-v4-legacy-taxonomy",
      targetEnv: TARGET,
      startedAt,
      finishedAt: new Date(),
      counts: {
        legacyContentUpdated: updated,
        total: counts?.total ?? 0,
        edufast: counts?.edufast ?? 0,
        nonEdufast: counts?.nonEdufast ?? 0,
        unmapped: counts?.unmapped ?? 0,
        legacyAdminsPromoted: promoted,
        unresolvedAssociations: unresolved.length,
      },
      checksum,
      notes:
        unresolved.length > 0
          ? `Tema tidak dikenali (default Informasi): ${unresolved
              .map((item) => item.theme ?? item.id)
              .slice(0, 20)
              .join(", ")}`
          : "Semua tema legacy dipetakan ke sub-tema kanonik.",
    });

    console.log(
      JSON.stringify(
        {
          legacyContentUpdated: updated,
          totals: counts,
          legacyAdminsPromoted: promoted,
          unresolvedAssociations: unresolved.length,
          checksum,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
