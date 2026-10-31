import { assertDestructiveTargetAllowed, loadScriptEnv } from "./_env";

const scriptTarget = loadScriptEnv();
assertDestructiveTargetAllowed(scriptTarget, "Reset demo");

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

import * as schema from "../src/db/schema";
import { DEMO_ACCOUNTS, getDemoSeedPassword } from "../src/lib/demo";
import { runSeed } from "./seed";

type SeedDb = NeonDatabase<typeof schema>;

const TABLES_IN_DELETE_ORDER = [
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
  "demo_rate_limits",
  "rate_limits",
  "migration_runs",
  "session",
  "account",
  "verification",
  '"user"',
] as const;

async function resetDemo(db: SeedDb): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.execute(sql.raw(`delete from ${table}`));
  }
  console.log("Data demo lama dihapus.");
  await runSeed(db);
  console.log("Data demo berhasil dipulihkan ke kondisi awal.");
}

async function createEmptyMaster(db: SeedDb): Promise<void> {
  const email = DEMO_ACCOUNTS.admin.email;
  const passwordHash = await hashPassword(getDemoSeedPassword());
  const userId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(schema.user).values({
      id: userId,
      name: "Master Admin DAKOSTA",
      email,
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await tx.insert(schema.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await tx.insert(schema.userProfiles).values({
      userId,
      mustChangePassword: false,
      isDemo: true,
      active: true,
      status: "ACTIVE",
      displayTitle: "Master Admin DAKOSTA",
    });
    await tx.insert(schema.userRoleMemberships).values({
      userId,
      role: "ADMIN",
    });
    await tx.insert(schema.userMemberships).values({
      userId,
      role: "MASTER_ADMIN",
    });
    await tx.insert(schema.auditLogs).values({
      actorId: null,
      actorRole: "SYSTEM",
      action: "BOOTSTRAP_MASTER",
      recordType: "AUTH",
      recordId: userId,
      after: { role: "MASTER_ADMIN", source: "reset-demo-empty" },
      source: "SCRIPT",
    });
  });
}

async function resetEmpty(db: SeedDb): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.execute(sql.raw(`delete from ${table}`));
  }
  await createEmptyMaster(db);
  console.log("Basis data dikosongkan; satu Master Admin demo dibuat (kredensial tidak dicetak).");
}

async function main(): Promise<void> {
  const runtimeEnv = process.env.APP_ENV ?? process.env.VERCEL_ENV;
  if (runtimeEnv === "production") {
    throw new Error(
      "Reset demo dilarang di production. Tidak ada perubahan yang dilakukan.",
    );
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });
  const empty = process.argv.includes("--empty");

  try {
    if (empty) {
      await resetEmpty(db);
    } else {
      await resetDemo(db);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
