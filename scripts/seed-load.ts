import { assertDestructiveTargetAllowed, loadScriptEnv } from "./_env";

const scriptTarget = loadScriptEnv();
assertDestructiveTargetAllowed(scriptTarget, "Seed beban");

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import { parsePeriod } from "../src/lib/periods";
import { SUB_THEMES } from "../src/lib/taxonomy";

const LOAD_PREFIX = "LOAD Instansi";
const PENDING_FILE = join(".tmp-load-test", "pending.json");
const CHUNK = 500;
const MONTHS = 12;

function argument(name: string, fallback?: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match?.split("=").slice(1).join("=") ?? fallback;
}

function positiveInt(name: string, fallback: number, max: number): number {
  const raw = Number(argument(name, String(fallback)));
  if (!Number.isInteger(raw) || raw < 1 || raw > max) {
    throw new Error(`--${name} harus bilangan bulat 1..${max}.`);
  }
  return raw;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFor(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

type LoadStatus = "APPROVED" | "REVISION_REQUIRED" | "PENDING";

function pickStatus(roll: number): LoadStatus {
  if (roll < 0.7) return "APPROVED";
  if (roll < 0.85) return "REVISION_REQUIRED";
  return "PENDING";
}

async function main(): Promise<void> {
  if (scriptTarget !== "staging" || process.env.APP_ENV !== "staging") {
    throw new Error(
      "Seed beban hanya diizinkan pada --target=staging dengan APP_ENV=staging. Tidak ada perubahan yang dilakukan.",
    );
  }

  const contents = positiveInt("contents", 100_000, 500_000);
  const orgs = positiveInt("orgs", 2_000, 10_000);
  const branches = positiveInt("branches", 200, 1_000);
  const regions = positiveInt("regions", 20, 100);
  if (orgs < branches) {
    throw new Error("--orgs harus lebih besar atau sama dengan --branches.");
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const pool = new Pool({ connectionString, max: 4 });
  const db = drizzle(pool, { schema });
  const started = performance.now();

  try {
    const demoBranch = await pool.query<{
      branch_id: string;
      branch_name: string;
      region_id: string;
    }>(
      `select b.id as branch_id, b.name as branch_name, b.regional_office_id as region_id
         from branch_offices b
        where b.status = 'ACTIVE'
        order by b.code
        limit 1`,
    );
    const demo = demoBranch.rows[0];
    if (!demo) {
      throw new Error(
        "Cabang demo tidak ditemukan. Jalankan `npm run db:reset:staging` sebelum seed beban.",
      );
    }

    const reviewers = await pool.query<{ id: string }>(
      `select u.id
         from "user" u
         join user_memberships m on m.user_id = u.id
        where m.role in ('BRANCH_ADMIN', 'MASTER_ADMIN') and m.revoked_at is null
        order by case when m.role = 'BRANCH_ADMIN' then 0 else 1 end, u.id
        limit 1`,
    );
    const creators = await pool.query<{ id: string }>(
      `select u.id
         from "user" u
         join user_memberships m on m.user_id = u.id
        where m.role = 'STAKEHOLDER' and m.revoked_at is null
        order by u.id
        limit 1`,
    );
    const reviewerId = reviewers.rows[0]?.id;
    const creatorId = creators.rows[0]?.id ?? reviewerId;
    if (!reviewerId || !creatorId) {
      throw new Error(
        "Akun demo tidak ditemukan. Jalankan `npm run db:reset:staging` sebelum seed beban.",
      );
    }

    console.log(
      `Membersihkan data beban sebelumnya (prefix ${LOAD_PREFIX}/${"LOAD-"}).`,
    );
    await db.execute(sql`delete from content_reviews where submission_id in (
      select id from content_submissions where reference_code like 'LOAD-%'
    )`);
    await db.execute(sql`delete from content_revisions where submission_id in (
      select id from content_submissions where reference_code like 'LOAD-%'
    )`);
    await db.execute(
      sql`delete from content_submissions where reference_code like 'LOAD-%'`,
    );
    await db.execute(
      sql`delete from kpi_targets where workspace_label = 'LOAD TEST'`,
    );
    await db.execute(
      sql`delete from locations where label like ${`${LOAD_PREFIX}%`}`,
    );
    await db.execute(
      sql`delete from stakeholders where name like ${`${LOAD_PREFIX}%`}`,
    );
    await db.execute(
      sql`delete from branch_offices where code like 'LOAD-BRG-%'`,
    );
    await db.execute(
      sql`delete from regional_offices where code like 'LOAD-REG-%'`,
    );

    const now = new Date();
    const current = parsePeriod(undefined, now);
    const months: Array<{
      key: string;
      start: string;
      end: string;
      startInstant: Date;
      endInstant: Date;
    }> = [];
    for (let offset = MONTHS - 1; offset >= 0; offset -= 1) {
      const reference = new Date(
        Date.UTC(current.year, current.month! - 1 - offset, 1),
      );
      const period = parsePeriod(
        `${reference.getUTCFullYear()}-${pad(reference.getUTCMonth() + 1)}`,
        now,
      );
      months.push({
        key: period.key,
        start: period.startDate,
        end: period.endDate,
        startInstant: period.start,
        endInstant: period.endExclusive,
      });
    }

    const random = mulberry32(20261101);
    const regionRows: Array<typeof schema.regionalOffices.$inferInsert> = [];
    for (let index = 0; index < regions; index += 1) {
      regionRows.push({
        id: uuidFor("d1000000", index + 1),
        code: `LOAD-REG-${String(index + 1).padStart(3, "0")}`,
        name: `Regional Beban ${index + 1}`,
        status: "ACTIVE",
      });
    }
    for (const batch of chunks(regionRows, 200)) {
      await db.insert(schema.regionalOffices).values(batch);
    }

    const branchRows: Array<typeof schema.branchOffices.$inferInsert> = [];
    for (let index = 0; index < branches; index += 1) {
      branchRows.push({
        id: uuidFor("d2000000", index + 1),
        regionalOfficeId: uuidFor("d1000000", (index % regions) + 1),
        code: `LOAD-BRG-${String(index + 1).padStart(3, "0")}`,
        name: `Cabang Beban ${index + 1}`,
        status: "ACTIVE",
      });
    }
    for (const batch of chunks(branchRows, 200)) {
      await db.insert(schema.branchOffices).values(batch);
    }

    const orgRows: Array<typeof schema.stakeholders.$inferInsert> = [];
    const orgBranchIds: string[] = [];
    const orgRegionIds: string[] = [];
    const locationRows: Array<typeof schema.locations.$inferInsert> = [];
    const orgSizes: number[] = [];
    for (let index = 0; index < orgs; index += 1) {
      const isDemoBranchOrg = index < Math.max(branches, 200);
      const branchId = isDemoBranchOrg
        ? demo.branch_id
        : uuidFor("d2000000", (index % branches) + 1);
      const regionId = isDemoBranchOrg
        ? demo.region_id
        : uuidFor("d1000000", (index % regions) + 1);
      orgBranchIds.push(branchId);
      orgRegionIds.push(regionId);
      orgSizes.push(10 + (index % 20) * 5);

      const kindRoll = random();
      const isFaskes = kindRoll < 0.7;
      const isPemda = !isFaskes && kindRoll < 0.85;
      const faskesClass = isFaskes
        ? index % 3 === 0
          ? "FKRTL"
          : "FKTP"
        : null;
      const category = isFaskes
        ? "FASKES"
        : isPemda
          ? "INSTANSI"
          : "ORGANISASI";
      const latitude = -6.9 + ((index % 40) - 20) * 0.18;
      const longitude = 107.6 + (Math.floor(index / 40) % 40) * 0.22;
      const id = uuidFor("d3000000", index + 1);

      orgRows.push({
        id,
        name: `${LOAD_PREFIX} ${String(index + 1).padStart(4, "0")}`,
        category,
        branchOfficeId: branchId,
        organizationType: isFaskes ? "FASKES" : isPemda ? "PEMDA" : "OTHER",
        faskesClass,
        faskesCode: isFaskes
          ? `LOAD-${String(index + 1).padStart(5, "0")}`
          : null,
        faskesCodeNormalized: isFaskes
          ? `load-${String(index + 1).padStart(5, "0")}`
          : null,
        faskesType: isFaskes
          ? faskesClass === "FKRTL"
            ? "Rumah Sakit"
            : "Puskesmas"
          : null,
        serviceArea: `Wilayah Beban ${(index % regions) + 1}`,
        addressLabel: `Jl. Sintetis No. ${index + 1}`,
        latitude,
        longitude,
        locationPrecision: "approximate",
        status: "ACTIVE",
        isDemo: true,
        joinedAt: "2024-01-01",
      });

      locationRows.push({
        id: uuidFor("d4000000", index + 1),
        stakeholderId: id,
        latitude,
        longitude,
        label: `${LOAD_PREFIX} ${String(index + 1).padStart(4, "0")}`,
        source: "registered_stakeholder",
        accuracyMeters: null,
        consentAt: null,
        verifiedStatus: "VERIFIED",
        precision: "approximate",
      });
    }
    for (const batch of chunks(orgRows, 400)) {
      await db.insert(schema.stakeholders).values(batch);
    }
    for (const batch of chunks(locationRows, 500)) {
      await db.insert(schema.locations).values(batch);
    }
    console.log(
      `${regions} regional, ${branches} cabang, ${orgs} instansi, ${orgs} lokasi.`,
    );

    const platforms = [
      "INSTAGRAM",
      "FACEBOOK",
      "X",
      "TIKTOK",
      "YOUTUBE",
      "WEBSITE",
    ] as const;
    const contentRows: Array<typeof schema.contentSubmissions.$inferInsert> =
      [];
    const reviewRows: Array<typeof schema.contentReviews.$inferInsert> = [];
    const pending: Array<{ id: string; version: number }> = [];
    let approvedCount = 0;
    let reviewCount = 0;
    let revisionCount = 0;

    for (let index = 0; index < contents; index += 1) {
      const bigBranchRoll = random();
      const orgIndex =
        bigBranchRoll < 0.25
          ? Math.floor(random() * Math.min(orgs, Math.max(branches, 200)))
          : Math.max(branches, 200) +
            Math.floor(random() * Math.max(1, orgs - Math.max(branches, 200)));
      const safeOrg = Math.min(orgIndex, orgs - 1);
      const month = months[Math.floor(random() * months.length)]!;
      const day = 1 + Math.floor(random() * (Number(month.end.slice(-2)) - 1));
      const dateCreated = `${month.key}-${pad(day)}`;
      const status = pickStatus(random());
      const id = uuidFor("d5000000", index + 1);
      const resubmitted = status === "APPROVED" && random() < 0.15;
      const version = resubmitted ? 2 : 1;
      const [monthYear, monthNumber] = month.key.split("-").map(Number) as [
        number,
        number,
      ];
      const submittedAt = new Date(
        Date.UTC(monthYear, monthNumber - 1, day, 3, 0, 0),
      );
      const approvedAt =
        status === "APPROVED"
          ? new Date(
              submittedAt.getTime() +
                (1 + Math.floor(random() * 9)) * 86_400_000,
            )
          : null;
      const theme = (random() < 0.6 ? "EDUFAST" : "NON_EDUFAST") as
        "EDUFAST" | "NON_EDUFAST";
      const subTheme = SUB_THEMES[Math.floor(random() * SUB_THEMES.length)]!;

      contentRows.push({
        id,
        referenceCode: `LOAD-${String(index + 1).padStart(8, "0")}`,
        stakeholderId: uuidFor("d3000000", safeOrg + 1),
        createdBy: creatorId,
        submittedBy: creatorId,
        title: `Konten beban ${index + 1}`,
        narrative: `Narasi sintetis untuk pengujian beban nomor ${index + 1}. Tanpa data pribadi.`,
        publishedUrl: `https://example.invalid/load/${index + 1}`,
        normalizedUrl: `https://example.invalid/load/${index + 1}`,
        normalizedUrlHash: `load-${index + 1}`,
        platform: platforms[index % platforms.length]!,
        contentType: index % 2 === 0 ? "VIDEO" : "INFOGRAFIS",
        mainTheme: theme,
        subTheme,
        resubmissionCount: resubmitted ? 1 : 0,
        dateCreated,
        locationId: uuidFor("d4000000", safeOrg + 1),
        branchOfficeId: orgBranchIds[safeOrg]!,
        regionalOfficeId: orgRegionIds[safeOrg]!,
        status: status === "PENDING" ? "SUBMITTED" : status,
        version,
        idempotencyKey: `load-${index + 1}`,
        firstSubmittedAt: submittedAt,
        submittedAt,
        approvedAt,
        reviewedBy: status === "PENDING" ? null : reviewerId,
        decisionReason:
          status === "PENDING" ? null : "Keputusan sintetis untuk uji beban.",
        isDemo: true,
        createdAt: submittedAt,
        updatedAt: approvedAt ?? submittedAt,
      });

      if (status === "APPROVED") approvedCount += 1;
      if (status === "REVISION_REQUIRED") revisionCount += 1;

      if (status === "PENDING") {
        if (orgBranchIds[safeOrg] === demo.branch_id) {
          pending.push({ id, version });
        }
      } else if (status === "APPROVED") {
        if (resubmitted) {
          reviewRows.push({
            id: uuidFor("d6000000", ++reviewCount),
            submissionId: id,
            version: 1,
            reviewerId,
            action: "REQUEST_REVISION",
            checklist: {
              relevansiTema: true,
              akurasiKonten: true,
              kelengkapanTautan: true,
              etikaDanPrivasi: true,
            },
            notes: "Perbaiki tautan sintetis sebelum disetujui.",
            previousStatus: "SUBMITTED",
            nextStatus: "REVISION_REQUIRED",
            conflictOfInterest: false,
            reviewerRole: "BRANCH_ADMIN",
            reviewerBranchId: orgBranchIds[safeOrg]!,
            decisionSource: "NORMAL",
            createdAt: submittedAt,
          });
        }
        reviewRows.push({
          id: uuidFor("d6000000", ++reviewCount),
          submissionId: id,
          version,
          reviewerId,
          action: "APPROVE",
          checklist: {
            relevansiTema: true,
            akurasiKonten: true,
            kelengkapanTautan: true,
            etikaDanPrivasi: true,
          },
          notes: null,
          previousStatus: "SUBMITTED",
          nextStatus: "APPROVED",
          conflictOfInterest: false,
          reviewerRole: "BRANCH_ADMIN",
          reviewerBranchId: orgBranchIds[safeOrg]!,
          decisionSource: "NORMAL",
          createdAt: approvedAt!,
        });
      } else {
        reviewRows.push({
          id: uuidFor("d6000000", ++reviewCount),
          submissionId: id,
          version,
          reviewerId,
          action: "REQUEST_REVISION",
          checklist: {
            relevansiTema: true,
            akurasiKonten: true,
            kelengkapanTautan: true,
            etikaDanPrivasi: true,
          },
          notes: "Konten sintetis perlu revisi untuk skenario beban.",
          previousStatus: "SUBMITTED",
          nextStatus: "REVISION_REQUIRED",
          conflictOfInterest: false,
          reviewerRole: "BRANCH_ADMIN",
          reviewerBranchId: orgBranchIds[safeOrg]!,
          decisionSource: "NORMAL",
          createdAt: new Date(submittedAt.getTime() + 86_400_000),
        });
      }

      if (contentRows.length >= CHUNK) {
        await db
          .insert(schema.contentSubmissions)
          .values(contentRows.splice(0));
      }
      if (reviewRows.length >= CHUNK) {
        if (contentRows.length > 0) {
          await db
            .insert(schema.contentSubmissions)
            .values(contentRows.splice(0));
        }
        await db.insert(schema.contentReviews).values(reviewRows.splice(0));
      }
      if (index > 0 && index % 20_000 === 0) {
        console.log(`  ${index} konten disiapkan...`);
      }
    }
    if (contentRows.length > 0)
      await db.insert(schema.contentSubmissions).values(contentRows);
    if (reviewRows.length > 0)
      await db.insert(schema.contentReviews).values(reviewRows);

    const targetRows: Array<typeof schema.kpiTargets.$inferInsert> = [];
    for (let orgIndex = 0; orgIndex < orgs; orgIndex += 1) {
      for (const month of months) {
        targetRows.push({
          id: uuidFor(
            "d7000000",
            orgIndex * MONTHS + months.indexOf(month) + 1,
          ),
          workspaceLabel: "LOAD TEST",
          stakeholderId: uuidFor("d3000000", orgIndex + 1),
          branchOfficeId: orgBranchIds[orgIndex]!,
          regionalOfficeId: orgRegionIds[orgIndex]!,
          periodStart: month.start,
          periodEnd: month.end,
          targetCount: orgSizes[orgIndex]!,
          reportingUnit: "konten",
          createdBy: reviewerId,
          updatedBy: reviewerId,
        });
      }
    }
    for (const batch of chunks(targetRows, 1_000)) {
      await db.insert(schema.kpiTargets).values(batch);
    }

    await mkdir(join(".tmp-load-test"), { recursive: true });
    await writeFile(
      PENDING_FILE,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        items: pending.slice(0, 5_000),
      }),
      "utf8",
    );

    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`Selesai dalam ${elapsed} detik.`);
    console.log(
      `Konten: ${contents} (approved ${approvedCount}, revisi ${revisionCount}, pending ${contents - approvedCount - revisionCount}).`,
    );
    console.log(
      `Review: ${reviewCount}. Target: ${targetRows.length}. Pending demo branch: ${pending.length}.`,
    );
    console.log(`Daftar pending untuk profil mixed: ${PENDING_FILE}`);
    console.log("Semua data sintetis is_demo=true; tidak ada PII.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
