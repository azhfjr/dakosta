import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { parse as parseEnvFile } from "dotenv";
import { sql, type SQL } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import { isProtectedAccountEmail } from "../src/lib/authz/protected-accounts";
import { SUB_THEMES } from "../src/lib/taxonomy";
import { loadScriptEnv, requireDatabaseUrlForScript } from "./_env";
import { chunk } from "./demo-chunk";
import {
  DEMO_ACCOUNTS,
  DEMO_BRANCHES,
  DEMO_IDS,
  DEMO_ORGANIZATIONS,
  DEMO_REGIONS,
  DEMO_SEED_VERSION,
  assertFixtureIntegrity,
  buildDemoDataset,
  expectedCounts,
  jakartaDateOnly,
  type DemoDataset,
  type DemoTheme,
} from "./demo-fixtures";
import {
  assertInvariantsPreserved,
  collectDemoScope,
  purgeDemoOnly,
  snapshotInvariants,
  type DemoInvariants,
  type DemoScope,
  type SqlExecutor,
} from "./demo-purge";

const DAY_MS = 86_400_000;
const BASE_URL =
  process.env.DEMO_BASE_URL ?? "https://dakosta-dakosta.vercel.app";
const CONFIRM_TOKEN = "seed-production-demo";

type SeedDb = NeonDatabase<typeof schema>;
export type SeedTx = Parameters<Parameters<SeedDb["transaction"]>[0]>[0];

function argValue(name: string, args: string[]): string | null {
  const prefix = `${name}=`;
  const match = args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function refuse(message: string): never {
  throw new Error(`${message} Tidak ada perubahan yang dilakukan.`);
}

function databaseIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function fingerprint(identity: string): string {
  return createHash("sha256").update(identity).digest("hex").slice(0, 12);
}

function stagingIdentity(): string | null {
  if (!existsSync(".env.staging.local")) return null;
  const parsed = parseEnvFile(readFileSync(".env.staging.local", "utf8"));
  const url = parsed.DATABASE_URL_UNPOOLED ?? parsed.DATABASE_URL;
  return url ? databaseIdentity(url) : null;
}

function assertCliGuards(args: string[]): {
  backupDir: string | null;
  dryRun: boolean;
} {
  const target = argValue("--target", args);
  const backupDir = argValue("--backup", args);
  const dryRun = args.includes("--dry-run");

  if (target !== "production") {
    refuse("Seed demo hanya boleh dijalankan dengan --target=production.");
  }

  loadScriptEnv("production");

  const runtimeEnv = (
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    ""
  ).toLowerCase();
  if (runtimeEnv === "staging") {
    refuse("APP_ENV/VERCEL_ENV menyatakan staging.");
  }
  if (process.env.DEMO_SEED_CONFIRM !== CONFIRM_TOKEN) {
    refuse(`Seed memerlukan DEMO_SEED_CONFIRM=${CONFIRM_TOKEN}.`);
  }

  if (!dryRun) {
    if (!backupDir) {
      refuse(
        "Seed memerlukan --backup=backups/<stamp>-production berisi manifest.json.",
      );
    }
    const manifestPath = resolve(process.cwd(), backupDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      refuse(`Manifest backup tidak ditemukan: ${manifestPath}.`);
    }
    let manifestTarget: unknown;
    try {
      manifestTarget = (
        JSON.parse(readFileSync(manifestPath, "utf8")) as { target?: unknown }
      ).target;
    } catch {
      refuse("Manifest backup tidak dapat dibaca.");
    }
    if (manifestTarget !== "production") {
      refuse("Manifest backup bukan untuk target production.");
    }
  }

  const productionIdentity = databaseIdentity(requireDatabaseUrlForScript());
  const staging = stagingIdentity();
  const matchesStaging = Boolean(
    productionIdentity && staging && productionIdentity === staging,
  );

  console.log(
    `db_fingerprint=sha256:${fingerprint(productionIdentity ?? "unknown")} matches_staging=${matchesStaging ? "yes" : "no"}`,
  );

  if (matchesStaging) {
    refuse(
      "Database produksi menunjuk ke basis data staging (fingerprint identik).",
    );
  }

  return { backupDir, dryRun };
}

function readScalar(reader: SqlExecutor, query: SQL): Promise<number> {
  return reader
    .execute(query)
    .then((result) => Number(result.rows[0]?.value ?? 0));
}

function uuidIn(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}::uuid`),
    sql`, `,
  );
}

function textIn(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

async function expectNoCollision(
  reader: SqlExecutor,
  query: SQL,
  label: string,
): Promise<void> {
  const total = await readScalar(reader, query);
  if (total > 0) {
    refuse(
      `Tabrakan kunci ${label}: ${total} baris non-demo memakai kunci demo.`,
    );
  }
}

async function insertChunked<T>(
  rows: readonly T[],
  insert: (values: T[]) => Promise<unknown>,
): Promise<void> {
  for (const part of chunk([...rows])) {
    await insert(part);
  }
}

async function preflight(
  reader: SqlExecutor,
  scope: DemoScope,
  dataset: DemoDataset,
): Promise<DemoInvariants> {
  for (const email of scope.emails) {
    if (isProtectedAccountEmail(email)) {
      refuse(`Email terlindungi ${email} masuk ke scope demo.`);
    }
  }

  const before = await snapshotInvariants(reader);

  const masterRows = await reader.execute(sql`
    select u.id, p.is_demo, p.status, p.active
      from "user" u
      join user_profiles p on p.user_id = u.id
     where u.email = 'admin@dakosta.local'
  `);
  if (masterRows.rows.length !== 1) {
    refuse(
      `Master asli harus tepat 1 akun (ditemukan ${masterRows.rows.length}).`,
    );
  }
  const master = masterRows.rows[0] as {
    id: string;
    is_demo: boolean;
    status: string;
    active: boolean;
  };
  if (
    master.is_demo !== false ||
    master.status !== "ACTIVE" ||
    master.active !== true
  ) {
    refuse("Master asli tidak aktif atau bertanda demo.");
  }
  if (
    before.masterAdminMemberships !== 1 ||
    before.masterUserId !== master.id
  ) {
    refuse("Membership MASTER_ADMIN aktif untuk akun asli bukan tepat 1.");
  }
  if (before.halfDemoUsers !== 0) {
    refuse(`Ditemukan ${before.halfDemoUsers} akun demo setengah jadi.`);
  }
  if (before.foreignDemoUsers !== 0) {
    refuse(
      `Ditemukan ${before.foreignDemoUsers} akun demo di luar dataset ini.`,
    );
  }

  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from regional_offices
         where code like 'REG-DEMO-%' and not (id in (${uuidIn(scope.regionIds)}))`,
    "regional_offices.code",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from branch_offices
         where code like 'CBG-DEMO-%' and not (id in (${uuidIn(scope.branchIds)}))`,
    "branch_offices.code",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from stakeholders
         where faskes_code_normalized like 'DEMO-%'
           and not (id in (${uuidIn(scope.stakeholderIds)}))`,
    "stakeholders.faskes_code_normalized",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from content_submissions
         where reference_code in (${textIn(dataset.submissions.map((item) => item.referenceCode))})
           and not (id in (${uuidIn(scope.submissionIds)}))`,
    "content_submissions.reference_code",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from content_submissions
         where idempotency_key like ${`${DEMO_SEED_VERSION}:%`}
           and not (id in (${uuidIn(scope.submissionIds)}))`,
    "content_submissions.idempotency_key",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from edufast_monthly_policies
         where status = 'PUBLISHED'
           and period_yyyy_mm in (${textIn(dataset.periods)})
           and not (id in (${uuidIn(scope.policyIds)}))`,
    "edufast_monthly_policies PUBLISHED",
  );
  await expectNoCollision(
    reader,
    sql`select count(*)::text as value from kpi_targets
         where period_start in (${textIn(dataset.periods.map((period) => `${period}-01`))})
           and not (id in (${uuidIn(scope.targetIds)}))`,
    "kpi_targets periode",
  );

  return before;
}

async function resolveThemeIds(
  tx: SeedTx,
  themes: readonly DemoTheme[],
): Promise<Map<string, string>> {
  await tx
    .insert(schema.themes)
    .values(
      themes.map((theme) => ({
        slug: theme.slug,
        name: theme.name,
        description: theme.description,
        active: true,
        sortOrder: theme.n,
      })),
    )
    .onConflictDoNothing();

  const rows = await tx
    .select({ id: schema.themes.id, slug: schema.themes.slug })
    .from(schema.themes);
  const ids = new Map(rows.map((row) => [row.slug, row.id]));
  for (const theme of themes) {
    if (!ids.has(theme.slug)) {
      throw new Error(`Tema referensi ${theme.slug} tidak dapat di-resolve.`);
    }
  }
  return ids;
}

function joinedAtDate(now: Date): string {
  return jakartaDateOnly(new Date(now.getTime() - 180 * DAY_MS));
}

export async function insertDemoDataset(
  tx: SeedTx,
  dataset: DemoDataset,
  passwordHash: string,
): Promise<void> {
  const now = dataset.now;
  const masterUserId = DEMO_IDS.user(1);
  const themeIds = await resolveThemeIds(tx, dataset.themes);

  await tx.insert(schema.regionalOffices).values(
    dataset.regions.map((region) => ({
      id: DEMO_IDS.region(region.n),
      code: region.code,
      name: region.name,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    })),
  );

  await tx.insert(schema.branchOffices).values(
    dataset.branches.map((branch) => ({
      id: DEMO_IDS.branch(branch.n),
      regionalOfficeId: DEMO_IDS.region(branch.regionN),
      code: branch.code,
      name: branch.name,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    })),
  );

  const joined = joinedAtDate(now);
  await tx.insert(schema.stakeholders).values(
    dataset.organizations.map((organization) => ({
      id: DEMO_IDS.organization(organization.n),
      name: organization.name,
      category: organization.category,
      branchOfficeId: DEMO_IDS.branch(organization.branchN),
      organizationType: organization.organizationType,
      faskesClass: organization.faskesClass,
      faskesCode: organization.faskesCode,
      faskesCodeNormalized: organization.faskesCode
        ? organization.faskesCode.trim().toUpperCase()
        : null,
      serviceArea: organization.serviceArea,
      addressLabel: organization.addressLabel,
      latitude: organization.latitude,
      longitude: organization.longitude,
      locationPrecision: "approximate",
      status: "ACTIVE",
      isDemo: true,
      joinedAt: joined,
      createdAt: new Date(now.getTime() - 180 * DAY_MS),
      updatedAt: now,
    })),
  );

  await tx.insert(schema.user).values(
    dataset.accounts.map((account) => ({
      id: DEMO_IDS.user(account.n),
      name: account.name,
      email: account.email,
      emailVerified: true,
      role: "user",
      createdAt: now,
      updatedAt: now,
    })),
  );

  await tx.insert(schema.account).values(
    dataset.accounts.map((account) => ({
      id: DEMO_IDS.account(account.n),
      accountId: DEMO_IDS.user(account.n),
      providerId: "credential",
      userId: DEMO_IDS.user(account.n),
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await tx.insert(schema.userProfiles).values(
    dataset.accounts.map((account) => ({
      userId: DEMO_IDS.user(account.n),
      mustChangePassword: false,
      isDemo: true,
      active: true,
      status: "ACTIVE",
      locationStatus: "VERIFIED",
      locationGraceDeadline: null,
      displayTitle: account.title,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await tx.insert(schema.userActivationLocations).values(
    dataset.accounts
      .filter((account) => account.role !== "MASTER_ADMIN")
      .map((account) => {
        const organization =
          account.organizationN !== null
            ? dataset.organizations.find(
                (item) => item.n === account.organizationN,
              )
            : undefined;
        return {
          userId: DEMO_IDS.user(account.n),
          latitude: organization ? organization.latitude : -6.9175,
          longitude: organization ? organization.longitude : 107.6191,
          accuracyMeters: 35,
          source: "demo_backfill",
          distanceMeters: 0,
          reviewFlag: false,
          consentAt: now,
          createdAt: now,
          updatedAt: now,
        };
      }),
  );

  await tx.insert(schema.userRoleMemberships).values(
    dataset.accounts.map((account) => ({
      id: DEMO_IDS.roleMembership(account.n),
      userId: DEMO_IDS.user(account.n),
      role: account.role === "MASTER_ADMIN" ? "ADMIN" : "CLIENT",
      createdAt: now,
    })),
  );

  await tx.insert(schema.userMemberships).values(
    dataset.accounts.map((account) => ({
      id: DEMO_IDS.membership(account.n),
      userId: DEMO_IDS.user(account.n),
      role: account.role,
      regionalOfficeId:
        account.role === "REGIONAL_ADMIN" && account.regionN !== null
          ? DEMO_IDS.region(account.regionN)
          : null,
      branchOfficeId:
        account.role === "BRANCH_ADMIN" && account.branchN !== null
          ? DEMO_IDS.branch(account.branchN)
          : null,
      organizationId:
        account.role === "STAKEHOLDER" && account.organizationN !== null
          ? DEMO_IDS.organization(account.organizationN)
          : null,
      effectiveAt: now,
      createdBy: masterUserId,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await tx.insert(schema.userStakeholderMemberships).values(
    dataset.accounts
      .filter((account) => account.organizationN !== null)
      .map((account) => ({
        id: DEMO_IDS.stakeholderMembership(account.organizationN!),
        userId: DEMO_IDS.user(account.n),
        stakeholderId: DEMO_IDS.organization(account.organizationN!),
        createdAt: now,
      })),
  );

  await insertChunked(
    dataset.policies.map((policy) => ({
      id: policy.id,
      periodYyyyMm: policy.period,
      timezone: "Asia/Jakarta",
      status: "PUBLISHED",
      version: 1,
      explanation: policy.explanation,
      createdBy: masterUserId,
      publishedBy: masterUserId,
      publishedAt: policy.publishedAt,
      createdAt: policy.createdAt,
      updatedAt: policy.publishedAt,
    })),
    (values) => tx.insert(schema.edufastMonthlyPolicies).values(values),
  );

  await insertChunked(
    dataset.policies.flatMap((policy) =>
      SUB_THEMES.map((subTheme) => ({
        policyId: policy.id,
        subTheme,
        createdAt: policy.publishedAt,
      })),
    ),
    (values) => tx.insert(schema.edufastPolicySubthemes).values(values),
  );

  await insertChunked(
    dataset.policyEvents.map((event) => ({
      id: event.id,
      policyId: DEMO_IDS.policy(event.policyN),
      action: event.action,
      actorId: masterUserId,
      snapshot: event.snapshot,
      createdAt: event.createdAt,
    })),
    (values) => tx.insert(schema.edufastPolicyEvents).values(values),
  );

  await insertChunked(
    dataset.locations.map((location) => ({
      id: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      label: location.label,
      source: location.source,
      accuracyMeters: location.accuracyMeters,
      consentAt: location.consentAt,
      verifiedStatus: location.verifiedStatus,
      precision: location.precision,
      createdAt: location.createdAt,
    })),
    (values) => tx.insert(schema.locations).values(values),
  );

  await insertChunked(
    dataset.submissions.map((submission) => ({
      id: submission.id,
      referenceCode: submission.referenceCode,
      stakeholderId: DEMO_IDS.organization(submission.organizationN),
      createdBy: DEMO_IDS.user(submission.authorAccountN),
      submittedBy: DEMO_IDS.user(submission.authorAccountN),
      title: submission.title,
      narrative: submission.narrative,
      publishedUrl: submission.publishedUrl,
      normalizedUrl: submission.normalizedUrl,
      normalizedUrlHash: submission.normalizedUrlHash,
      platform: submission.platform,
      contentType: submission.contentType,
      mainTheme: submission.mainTheme,
      subTheme: submission.subTheme,
      edufastPolicyId:
        submission.edufastPolicyN !== null
          ? DEMO_IDS.policy(submission.edufastPolicyN)
          : null,
      edufastPolicyVersion: submission.edufastPolicyVersion,
      approvedSnapshot: submission.approvedSnapshot,
      approvedVersion: submission.approvedVersion,
      resubmissionCount: submission.resubmissionCount,
      themeId: themeIds.get(submission.themeSlug) ?? null,
      dateCreated: submission.dateCreated,
      publishedAt: submission.publishedAt,
      locationId: DEMO_IDS.location(submission.n),
      branchOfficeId: DEMO_IDS.branch(submission.branchN),
      regionalOfficeId: DEMO_IDS.region(submission.regionN),
      status: submission.status,
      version: submission.version,
      idempotencyKey: submission.idempotencyKey,
      firstSubmittedAt:
        submission.status === "SUBMITTED" &&
        submission.version > 1 &&
        submission.submittedAt !== null
          ? new Date(submission.submittedAt.getTime() - DAY_MS)
          : submission.submittedAt,
      submittedAt: submission.submittedAt,
      approvedAt: submission.approvedAt,
      revokedAt: submission.revokedAt,
      reviewedBy:
        submission.reviewerAccountN !== null
          ? DEMO_IDS.user(submission.reviewerAccountN)
          : null,
      decisionReason: submission.decisionReason,
      archived: submission.archived,
      isDemo: true,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    })),
    (values) => tx.insert(schema.contentSubmissions).values(values),
  );

  await insertChunked(
    dataset.revisions.map((revision) => ({
      id: revision.id,
      submissionId: DEMO_IDS.submission(revision.submissionN),
      version: revision.version,
      snapshot: revision.snapshot,
      actorId: DEMO_IDS.user(revision.actorAccountN),
      reason: revision.reason,
      createdAt: revision.createdAt,
    })),
    (values) => tx.insert(schema.contentRevisions).values(values),
  );

  await insertChunked(
    dataset.reviews.map((review) => {
      const submission = dataset.submissions[review.submissionN - 1]!;
      return {
        id: review.id,
        submissionId: DEMO_IDS.submission(review.submissionN),
        version: review.version,
        reviewerId: DEMO_IDS.user(review.reviewerAccountN),
        action: review.action,
        checklist: review.checklist,
        notes: review.notes,
        previousStatus: review.previousStatus,
        nextStatus: review.nextStatus,
        conflictOfInterest: false,
        reviewerRole: review.reviewerRole,
        reviewerBranchId: DEMO_IDS.branch(submission.branchN),
        decisionSource: "NORMAL",
        createdAt: review.createdAt,
      };
    }),
    (values) => tx.insert(schema.contentReviews).values(values),
  );

  await insertChunked(
    dataset.targets.map((targetItem) => ({
      id: targetItem.id,
      workspaceLabel: targetItem.workspaceLabel,
      stakeholderId:
        targetItem.organizationN !== null
          ? DEMO_IDS.organization(targetItem.organizationN)
          : null,
      subTheme: targetItem.subTheme,
      periodStart: targetItem.periodStart,
      periodEnd: targetItem.periodEnd,
      targetCount: targetItem.targetCount,
      reportingUnit: "konten",
      createdBy: masterUserId,
      updatedBy: masterUserId,
      createdAt: targetItem.createdAt,
      updatedAt: targetItem.createdAt,
    })),
    (values) => tx.insert(schema.kpiTargets).values(values),
  );

  await insertChunked(
    dataset.notifications.map((notification) => ({
      id: notification.id,
      recipientId: DEMO_IDS.user(notification.recipientAccountN),
      eventType: notification.eventType,
      title: notification.title,
      body: notification.body,
      objectType: notification.objectType,
      objectId: notification.objectId,
      href: notification.href,
      branchOfficeId:
        notification.branchN !== null
          ? DEMO_IDS.branch(notification.branchN)
          : null,
      organizationId:
        notification.organizationN !== null
          ? DEMO_IDS.organization(notification.organizationN)
          : null,
      readAt: notification.readAt,
      dedupeKey: notification.dedupeKey,
      createdAt: notification.createdAt,
    })),
    (values) => tx.insert(schema.notifications).values(values),
  );

  await insertChunked(
    dataset.outbox.map((item) => ({
      id: item.id,
      eventKey: item.eventKey,
      aggregateType: item.aggregateType,
      aggregateId: item.aggregateId,
      eventType: item.eventType,
      payload: item.payload,
      recipientId: DEMO_IDS.user(item.recipientAccountN),
      notificationId: DEMO_IDS.notification(item.notificationN),
      attempts: 1,
      processedAt: item.processedAt,
      createdAt: item.createdAt,
    })),
    (values) => tx.insert(schema.outboxEvents).values(values),
  );

  await insertChunked(
    dataset.audits.map((audit) => ({
      id: audit.id,
      actorId: DEMO_IDS.user(audit.actorAccountN),
      actorRole: audit.actorRole,
      action: audit.action,
      recordType: audit.recordType,
      recordId: audit.recordId,
      after: audit.after,
      regionId: audit.regionN !== null ? DEMO_IDS.region(audit.regionN) : null,
      branchId: audit.branchN !== null ? DEMO_IDS.branch(audit.branchN) : null,
      organizationId:
        audit.organizationN !== null
          ? DEMO_IDS.organization(audit.organizationN)
          : null,
      correlationId: DEMO_SEED_VERSION,
      reason: "Seed dataset demo produksi",
      source: "SEED",
      createdAt: audit.createdAt,
    })),
    (values) => tx.insert(schema.auditLogs).values(values),
  );
}

function scopeLabel(account: (typeof DEMO_ACCOUNTS)[number]): string {
  if (account.role === "MASTER_ADMIN") return "global";
  if (account.role === "REGIONAL_ADMIN") {
    const region = DEMO_REGIONS.find((item) => item.n === account.regionN);
    return `wilayah=${region?.name ?? "-"}`;
  }
  if (account.role === "BRANCH_ADMIN") {
    const branch = DEMO_BRANCHES.find((item) => item.n === account.branchN);
    return `cabang=${branch?.name ?? "-"}`;
  }
  const organization = DEMO_ORGANIZATIONS.find(
    (item) => item.n === account.organizationN,
  );
  return `organisasi=${organization?.name ?? "-"}`;
}

function resolveDemoPassword(): {
  password: string;
  source: "env" | "generated";
} {
  const fromEnv = process.env.DEMO_SEED_PASSWORD;
  if (fromEnv && fromEnv.length >= 12) {
    return { password: fromEnv, source: "env" };
  }
  return {
    password: `${randomBytes(18).toString("base64url")}Aa1`,
    source: "generated",
  };
}

function writeCredentialsFile(
  password: string,
  stamp: string,
  now: Date,
): string {
  const directory = resolve(process.cwd(), ".secrets");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    chmodSync(directory, 0o700);
  } catch {
    // Windows ignores POSIX modes; the file is still written with restricted mode.
  }

  const lines = [
    "DAKOSTA - Akun Demo Produksi",
    `dibuat=${now.toISOString()}`,
    `base_url=${BASE_URL}`,
    `kata_sandi_bersama=${password}`,
    `jumlah_akun=${DEMO_ACCOUNTS.length}`,
    "",
    "peran | email | cakupan",
    ...DEMO_ACCOUNTS.map(
      (account) =>
        `${account.role} | ${account.email} | ${scopeLabel(account)}`,
    ),
    "",
  ];
  const file = join(directory, `demo-accounts-${stamp}.txt`);
  writeFileSync(file, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Best effort on platforms without POSIX modes.
  }
  return `.secrets/demo-accounts-${stamp}.txt`;
}

export async function assertSeededCounts(
  reader: SqlExecutor,
  dataset: DemoDataset,
  scope: DemoScope,
  before: DemoInvariants,
  counts: ReturnType<typeof expectedCounts>,
): Promise<void> {
  const expectCount = async (
    label: string,
    query: SQL,
    expected: number,
  ): Promise<void> => {
    const actual = await readScalar(reader, query);
    if (actual !== expected) {
      throw new Error(
        `Assertion gagal: ${label} = ${actual}, harapan ${expected}. Transaksi dibatalkan.`,
      );
    }
  };

  await expectCount(
    "user_profiles is_demo",
    sql`select count(*)::text as value from user_profiles where is_demo = true`,
    counts.accounts,
  );
  await expectCount(
    "akun MASTER_ADMIN",
    sql`select count(*)::text as value from user_memberships where role = 'MASTER_ADMIN' and user_id in (${textIn(scope.userIds)})`,
    counts.masterAccounts,
  );
  await expectCount(
    "akun REGIONAL_ADMIN",
    sql`select count(*)::text as value from user_memberships where role = 'REGIONAL_ADMIN' and user_id in (${textIn(scope.userIds)})`,
    counts.regionalAccounts,
  );
  await expectCount(
    "akun BRANCH_ADMIN",
    sql`select count(*)::text as value from user_memberships where role = 'BRANCH_ADMIN' and user_id in (${textIn(scope.userIds)})`,
    counts.branchAccounts,
  );
  await expectCount(
    "akun STAKEHOLDER",
    sql`select count(*)::text as value from user_memberships where role = 'STAKEHOLDER' and user_id in (${textIn(scope.userIds)})`,
    counts.stakeholderAccounts,
  );
  await expectCount(
    "konten",
    sql`select count(*)::text as value from content_submissions where is_demo = true`,
    counts.submissions,
  );
  for (const [status, expected] of Object.entries(counts.status)) {
    await expectCount(
      `konten ${status}`,
      sql`select count(*)::text as value from content_submissions where is_demo = true and status = ${status}`,
      expected,
    );
  }
  await expectCount(
    "konten EDUFAST",
    sql`select count(*)::text as value from content_submissions where is_demo = true and main_theme = 'EDUFAST'`,
    counts.edufast,
  );
  await expectCount(
    "sub-tema EDUFAST",
    sql`select count(distinct sub_theme)::text as value from content_submissions where is_demo = true and main_theme = 'EDUFAST'`,
    counts.edufastDistinctSubthemes,
  );
  await expectCount(
    "konten VIDEO",
    sql`select count(*)::text as value from content_submissions where is_demo = true and content_type = 'VIDEO'`,
    counts.video,
  );
  await expectCount(
    "konten INFOGRAFIS",
    sql`select count(*)::text as value from content_submissions where is_demo = true and content_type = 'INFOGRAFIS'`,
    counts.infografis,
  );
  const approvedMonth = (period: string) => sql`
    select count(*)::text as value
      from content_submissions
     where is_demo = true
       and status = 'APPROVED'
       and to_char(approved_at at time zone 'Asia/Jakarta', 'YYYY-MM') = ${period}
  `;
  await expectCount(
    "approved periode berjalan",
    approvedMonth(dataset.currentPeriod),
    counts.approvedCurrent,
  );
  await expectCount(
    "approved periode sebelumnya",
    approvedMonth(dataset.previousPeriod),
    counts.approvedPrevious,
  );
  await expectCount(
    "approved periode tertua",
    approvedMonth(counts.oldestPeriod),
    counts.approvedOldest,
  );
  const perPeriod = counts.submissions / counts.periods.length;
  await expectCount(
    "periode konten lengkap",
    sql`select count(*)::text as value
          from (
            select to_char(date_created, 'YYYY-MM') as period
              from content_submissions
             where is_demo = true
             group by 1
            having count(*) = ${perPeriod}
          ) periods`,
    counts.periods.length,
  );
  await expectCount(
    "approved per instansi dan periode",
    sql`select count(*)::text as value
          from (
            select stakeholder_id,
                   to_char(approved_at at time zone 'Asia/Jakarta', 'YYYY-MM') as period
              from content_submissions
             where is_demo = true
               and status = 'APPROVED'
               and approved_at is not null
             group by 1, 2
          ) coverage`,
    counts.organizations * counts.periods.length,
  );
  await expectCount(
    "lokasi",
    sql`select count(*)::text as value from locations where id in (${uuidIn(scope.locationIds)})`,
    counts.locations,
  );
  await expectCount(
    "revisi",
    sql`select count(*)::text as value from content_revisions where id in (${uuidIn(scope.revisionIds)})`,
    counts.revisions,
  );
  await expectCount(
    "ulasan",
    sql`select count(*)::text as value from content_reviews where id in (${uuidIn(scope.reviewIds)})`,
    counts.reviews,
  );
  await expectCount(
    "target KPI",
    sql`select count(*)::text as value from kpi_targets where id in (${uuidIn(scope.targetIds)})`,
    counts.targets,
  );
  await expectCount(
    "bentuk target per periode",
    sql`select count(*)::text as value
          from (
            select period_start
              from kpi_targets
             where id in (${uuidIn(scope.targetIds)})
             group by period_start
            having count(*) = ${1 + SUB_THEMES.length + counts.organizations}
               and count(*) filter (where stakeholder_id is null and sub_theme is null) = 1
               and count(*) filter (where stakeholder_id is not null and sub_theme is null) = ${counts.organizations}
               and count(*) filter (where stakeholder_id is null and sub_theme is not null) = ${SUB_THEMES.length}
          ) periods`,
    counts.periods.length,
  );
  await expectCount(
    "notifikasi",
    sql`select count(*)::text as value from notifications where id in (${uuidIn(scope.notificationIds)})`,
    counts.notifications,
  );
  await expectCount(
    "outbox",
    sql`select count(*)::text as value from outbox_events where id in (${uuidIn(scope.outboxIds)})`,
    counts.outbox,
  );
  await expectCount(
    "audit",
    sql`select count(*)::text as value from audit_logs where id in (${uuidIn(scope.auditIds)})`,
    counts.audits,
  );
  await expectCount(
    "wilayah",
    sql`select count(*)::text as value from regional_offices where id in (${uuidIn(scope.regionIds)})`,
    counts.regions,
  );
  await expectCount(
    "cabang",
    sql`select count(*)::text as value from branch_offices where id in (${uuidIn(scope.branchIds)})`,
    counts.branches,
  );
  await expectCount(
    "organisasi",
    sql`select count(*)::text as value from stakeholders where id in (${uuidIn(scope.stakeholderIds)})`,
    counts.organizations,
  );
  await expectCount(
    "kebijakan EDUFAST",
    sql`select count(*)::text as value from edufast_monthly_policies where id in (${uuidIn(scope.policyIds)})`,
    counts.policies,
  );
  await expectCount(
    "sub-tema kebijakan",
    sql`select count(*)::text as value from edufast_policy_subthemes where policy_id in (${uuidIn(scope.policyIds)})`,
    counts.policySubthemes,
  );
  await expectCount(
    "peristiwa kebijakan",
    sql`select count(*)::text as value from edufast_policy_events where id in (${uuidIn(scope.policyEventIds)})`,
    counts.policyEvents,
  );
  await expectCount(
    "profil non-demo",
    sql`select count(*)::text as value from user_profiles where is_demo = false`,
    1,
  );

  const after = await snapshotInvariants(reader);
  assertInvariantsPreserved(before, after);
}

async function runTransaction(
  db: SeedDb,
  dataset: DemoDataset,
  scope: DemoScope,
  before: DemoInvariants,
  passwordHash: string,
  counts: ReturnType<typeof expectedCounts>,
  startedAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const lock = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtext('dakosta.demo.seed.production')) as locked`,
    );
    if (lock.rows[0]?.locked !== true) {
      throw new Error(
        "Seed demo lain sedang berjalan (advisory lock gagal). Transaksi dibatalkan.",
      );
    }

    await purgeDemoOnly(tx, scope);
    await insertDemoDataset(tx, dataset, passwordHash);

    await assertSeededCounts(tx, dataset, scope, before, counts);

    await tx.insert(schema.migrationRuns).values({
      name: "seed-demo-production",
      targetEnv: "production",
      startedAt,
      finishedAt: new Date(),
      counts: {
        regions: counts.regions,
        branches: counts.branches,
        organizations: counts.organizations,
        accounts: counts.accounts,
        submissions: counts.submissions,
        periods: counts.periods.length,
        locations: counts.locations,
        revisions: counts.revisions,
        reviews: counts.reviews,
        targets: counts.targets,
        notifications: counts.notifications,
        outbox: counts.outbox,
        audits: counts.audits,
        policies: counts.policies,
        policySubthemes: counts.policySubthemes,
        policyEvents: counts.policyEvents,
        approvedCurrent: counts.approvedCurrent,
        approvedPrevious: counts.approvedPrevious,
        approvedOldest: counts.approvedOldest,
        oldestTarget: counts.oldestTarget,
      },
      checksum: createHash("sha256")
        .update(
          JSON.stringify([
            dataset.currentPeriod,
            counts.accounts,
            counts.submissions,
            counts.targets,
            counts.reviews,
          ]),
        )
        .digest("hex")
        .slice(0, 16),
      notes: `Dataset demo ${counts.periods.length} bulan (${dataset.currentPeriod}..${counts.oldestPeriod}), ${counts.submissions} konten dan ${counts.targets} target oleh ${counts.stakeholderAccounts} stakeholder.`,
    });
  });
}

async function main(): Promise<void> {
  const { dryRun } = assertCliGuards(process.argv.slice(2));
  const now = new Date();
  assertFixtureIntegrity(now);
  const dataset = buildDemoDataset(now);
  const counts = expectedCounts(now);
  const scope = collectDemoScope(now);

  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });
  const db = drizzle(pool, { schema });

  try {
    const before = await preflight(db, scope, dataset);

    console.log(
      `preflight=ok master_fingerprint_unchanged=yes akun=${counts.accounts} konten=${counts.submissions} stakeholder=${counts.stakeholderAccounts}`,
    );
    console.log(
      `periode_berjalan=${dataset.currentPeriod} periode_sebelumnya=${dataset.previousPeriod} approved=${counts.approvedCurrent}/${counts.approvedPrevious} target=${counts.currentTarget}/${counts.previousTarget}`,
    );
    console.log(
      `rencana: wilayah=${counts.regions} cabang=${counts.branches} organisasi=${counts.organizations} lokasi=${counts.locations} revisi=${counts.revisions} ulasan=${counts.reviews} target=${counts.targets} notifikasi=${counts.notifications} outbox=${counts.outbox} audit=${counts.audits}`,
    );

    if (dryRun) {
      const approvedByPeriod = new Map<string, number>();
      for (const submission of dataset.submissions) {
        if (
          submission.status !== "APPROVED" ||
          submission.approvedAt === null
        ) {
          continue;
        }
        const period = jakartaDateOnly(submission.approvedAt).slice(0, 7);
        approvedByPeriod.set(period, (approvedByPeriod.get(period) ?? 0) + 1);
      }
      for (const period of dataset.periods) {
        const content = dataset.submissions.filter(
          (submission) => submission.period === period,
        ).length;
        const globalTarget =
          dataset.targets.find(
            (target) =>
              target.period === period &&
              target.organizationN === null &&
              target.subTheme === null,
          )?.targetCount ?? 0;
        console.log(
          `periode=${period} konten=${content} approved=${approvedByPeriod.get(period) ?? 0} target_global=${globalTarget}`,
        );
      }
      console.log(
        `total: periode=${dataset.periods.length} konten=${dataset.submissions.length} approved=${counts.approved} target=${counts.targets}`,
      );
      console.log("Dry run selesai. Tidak ada baris yang ditulis.");
      return;
    }

    const { password, source } = resolveDemoPassword();
    console.log(
      `kredensial: sumber=${source === "env" ? "DEMO_SEED_PASSWORD" : "generated"} (nilai tidak dicetak)`,
    );

    const passwordHash = await hashPassword(password);
    const startedAt = new Date();
    await runTransaction(
      db,
      dataset,
      scope,
      before,
      passwordHash,
      counts,
      startedAt,
    );

    const after = await snapshotInvariants(db);
    assertInvariantsPreserved(before, after);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const credentialsPath = writeCredentialsFile(password, stamp, now);

    console.log("Seed demo produksi selesai.");
    console.log(
      `Akun demo: ${counts.accounts} (master 1, wilayah 3, cabang ${counts.branchAccounts}, stakeholder ${counts.stakeholderAccounts}).`,
    );
    console.log(
      `Konten demo: ${counts.submissions} (approved ${counts.approved}, pending ${counts.pending}, EDUFAST ${counts.edufast}).`,
    );
    console.log(`Kredensial: ${credentialsPath} (mode 0600, tidak dicetak).`);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
