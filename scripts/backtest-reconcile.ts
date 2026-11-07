/**
 * R13 backtest: replays synthetic multi-month data through the real analytics
 * services and reconciles every surface against one SQL definition of
 * "approved in scope".
 *
 * Runs fully in-memory (PGlite + the shipped migrations), so it is safe to run
 * anywhere and never touches a deployed database.
 *
 *   npx tsx --conditions=react-server scripts/backtest-reconcile.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../src/db/schema";
import {
  DASHBOARD_TREND_MONTHS,
  getApprovedDashboard,
} from "../src/lib/analytics/dashboard";
import {
  listAnalyticsContents,
  type AnalyticsContentFilters,
} from "../src/lib/analytics/content-table";
import { getSlaAnalytics, type SlaFilters } from "../src/lib/analytics/sla";
import { capabilitiesForRole } from "../src/lib/authz/capabilities";
import type { Scope } from "../src/lib/authz/types";
import {
  monthKeyFor,
  monthRange,
  previousMonthKey,
} from "../src/lib/kpi/formulas";
import { CONTENT_REPORT_ROW_CAP } from "../src/lib/reports/content-pdf";
import type { AppRole, SessionUser } from "../src/lib/session";

const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
  "0004_v1_1_foundations.sql",
  "0005_v1_1_perf_indexes.sql",
  "0006_v1_2_imports_sync.sql",
];

const REGION_A = "a0000000-0000-4000-8000-00000000000a";
const REGION_B = "b0000000-0000-4000-8000-00000000000b";
const BRANCH_A1 = "a1000000-0000-4000-8000-000000000001";
const BRANCH_A2 = "a2000000-0000-4000-8000-000000000002";
const BRANCH_B1 = "b1000000-0000-4000-8000-000000000001";
const ORG_S1 = "51000000-0000-4000-8000-000000000001";
const ORG_S2 = "52000000-0000-4000-8000-000000000002";
const ORG_S3 = "53000000-0000-4000-8000-000000000003";
const ORG_S4 = "54000000-0000-4000-8000-000000000004";
const ORG_S5 = "55000000-0000-4000-8000-000000000005";
const MASTER_ID = "bt-master";
const REGIONAL_ID = "bt-regional";
const BRANCH_ID = "bt-branch";
const STAKEHOLDER_ID = "bt-stakeholder";

const ORGS = [
  {
    id: ORG_S1,
    name: "Klinik Sehat A1",
    category: "FASKES",
    type: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "FKTP-BT-01",
    branchId: BRANCH_A1,
    regionId: REGION_A,
    latitude: -6.9,
    longitude: 107.6,
  },
  {
    id: ORG_S2,
    name: "RS Mitra A2",
    category: "FASKES",
    type: "FASKES",
    faskesClass: "FKRTL",
    faskesCode: "FKRTL-BT-02",
    branchId: BRANCH_A2,
    regionId: REGION_A,
    latitude: -6.95,
    longitude: 107.65,
  },
  {
    id: ORG_S3,
    name: "Pemda Wilayah A",
    category: "INSTANSI",
    type: "PEMDA",
    faskesClass: null,
    faskesCode: null,
    branchId: BRANCH_A1,
    regionId: REGION_A,
    latitude: -6.92,
    longitude: 107.62,
  },
  {
    id: ORG_S4,
    name: "Media Wilayah B",
    category: "MEDIA",
    type: "OTHER",
    faskesClass: null,
    faskesCode: null,
    branchId: BRANCH_B1,
    regionId: REGION_B,
    latitude: -6.2,
    longitude: 106.8,
  },
  {
    id: ORG_S5,
    name: "Klinik Wilayah B",
    category: "FASKES",
    type: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "FKTP-BT-05",
    branchId: BRANCH_B1,
    regionId: REGION_B,
    latitude: -6.25,
    longitude: 106.85,
  },
] as const;

const MONTH_KEYS = [
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
];

const PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "WEBSITE",
  "TIKTOK",
  "LAINNYA",
];
const SUB_THEMES = [
  "MOBILE_JKN",
  "TESTIMONI_PESERTA",
  "ALUR_BEROBAT",
  "EDUKATIF_PERSUASIF",
];

type Fixture = {
  id: string;
  reference: string;
  orgId: string;
  branchId: string;
  regionId: string;
  status: string;
  approvedAt: Date | null;
  dateCreated: string;
  platform: string;
  contentType: string | null;
  mainTheme: string | null;
  subTheme: string | null;
  archived?: boolean;
  title: string;
  url: string;
};

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const checks: Check[] = [];
let client: PGlite;
let fixtureSeq = 0;

function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
  const label = ok ? "PASS" : "FAIL";
  console.log(`[${label}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function expectEqual(name: string, actual: number, expected: number): void {
  check(name, actual === expected, `actual=${actual} expected=${expected}`);
}

function jakartaMonth(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(instant);
}

function uuid(prefix: string, index: number): string {
  const tail = String(index).padStart(12, "0");
  return `${prefix.padEnd(8, "0")}-0000-4000-8000-${tail}`;
}

function fixture(input: Omit<Fixture, "id" | "reference">): Fixture {
  fixtureSeq += 1;
  return {
    ...input,
    id: uuid("c0", fixtureSeq),
    reference: `BT-${String(fixtureSeq).padStart(4, "0")}`,
  };
}

function orgFixture(
  orgId: string,
  month: string,
  day: string,
  index: number,
): Fixture {
  const org = ORGS.find((entry) => entry.id === orgId)!;
  return fixture({
    orgId,
    branchId: org.branchId,
    regionId: org.regionId,
    status: "APPROVED",
    approvedAt: new Date(`${month}-${day}T03:00:00.000Z`),
    dateCreated: `${month}-05`,
    platform: PLATFORMS[index % PLATFORMS.length]!,
    contentType: index % 2 === 0 ? "VIDEO" : "INFOGRAFIS",
    mainTheme: index % 3 === 0 ? "EDUFAST" : "NON_EDUFAST",
    subTheme: SUB_THEMES[index % SUB_THEMES.length]!,
    title: `Konten ${month} ${org.name}`,
    url: `https://contoh.test/${month}/${orgId}/${index}`,
  });
}

function buildFixtures(): Fixture[] {
  const rows: Fixture[] = [];

  for (const [monthIndex, month] of MONTH_KEYS.entries()) {
    const plan: Array<{ orgId: string; count: number }> = [
      { orgId: ORG_S1, count: 2 },
      { orgId: ORG_S2, count: 1 },
      { orgId: ORG_S3, count: 1 },
      { orgId: ORG_S4, count: 1 },
      { orgId: ORG_S5, count: monthIndex % 2 === 0 ? 1 : 0 },
    ];
    for (const entry of plan) {
      for (let index = 0; index < entry.count; index += 1) {
        rows.push(
          orgFixture(
            entry.orgId,
            month,
            "10",
            monthIndex + index + rows.length,
          ),
        );
      }
    }

    rows.push(
      fixture({
        orgId: ORG_S1,
        branchId: BRANCH_A1,
        regionId: REGION_A,
        status: "SUBMITTED",
        approvedAt: null,
        dateCreated: `${month}-12`,
        platform: "INSTAGRAM",
        contentType: "VIDEO",
        mainTheme: "EDUFAST",
        subTheme: "MOBILE_JKN",
        title: `Diajukan ${month}`,
        url: `https://contoh.test/${month}/submitted`,
      }),
    );
  }

  // Non-approved statuses inside the current SLA period.
  rows.push(
    fixture({
      orgId: ORG_S2,
      branchId: BRANCH_A2,
      regionId: REGION_A,
      status: "REVISION_REQUIRED",
      approvedAt: null,
      dateCreated: "2026-10-14",
      platform: "FACEBOOK",
      contentType: "INFOGRAFIS",
      mainTheme: "NON_EDUFAST",
      subTheme: "ALUR_BEROBAT",
      title: "Perlu revisi Oktober",
      url: "https://contoh.test/2026-10/revision",
    }),
    fixture({
      orgId: ORG_S3,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "REJECTED",
      approvedAt: null,
      dateCreated: "2026-10-16",
      platform: "WEBSITE",
      contentType: "INFOGRAFIS",
      mainTheme: "NON_EDUFAST",
      subTheme: "EDUKATIF_PERSUASIF",
      title: "Ditolak Oktober",
      url: "https://contoh.test/2026-10/rejected",
    }),
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "DRAFT",
      approvedAt: null,
      dateCreated: "2026-10-18",
      platform: "TIKTOK",
      contentType: null,
      mainTheme: null,
      subTheme: null,
      title: "Draf Oktober",
      url: "https://contoh.test/2026-10/draft",
    }),
    fixture({
      orgId: ORG_S2,
      branchId: BRANCH_A2,
      regionId: REGION_A,
      status: "IN_REVIEW",
      approvedAt: null,
      dateCreated: "2026-09-20",
      platform: "YOUTUBE",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "TESTIMONI_PESERTA",
      title: "Sedang ditinjau",
      url: "https://contoh.test/2026-09/review",
    }),
  );

  // Asia/Jakarta month boundaries: 17:00Z is midnight in Jakarta.
  rows.push(
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-09-30T17:30:00.000Z"),
      dateCreated: "2026-09-30",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Batas awal Oktober",
      url: "https://contoh.test/boundary/oct-start",
    }),
    fixture({
      orgId: ORG_S2,
      branchId: BRANCH_A2,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-10-31T16:59:00.000Z"),
      dateCreated: "2026-10-31",
      platform: "FACEBOOK",
      contentType: "INFOGRAFIS",
      mainTheme: "NON_EDUFAST",
      subTheme: "KORPORAT",
      title: "Batas akhir Oktober",
      url: "https://contoh.test/boundary/oct-end",
    }),
    fixture({
      orgId: ORG_S3,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-10-31T17:00:00.000Z"),
      dateCreated: "2026-10-31",
      platform: "WEBSITE",
      contentType: "INFOGRAFIS",
      mainTheme: "NON_EDUFAST",
      subTheme: "INFORMASI",
      title: "Awal November",
      url: "https://contoh.test/boundary/nov-start",
    }),
  );

  // Orphan sub-theme and missing type/platform keys.
  rows.push(
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-08-11T04:00:00.000Z"),
      dateCreated: "2026-08-11",
      platform: "LAINNYA",
      contentType: null,
      mainTheme: "NON_EDUFAST",
      subTheme: null,
      title: "Tanpa sub-tema",
      url: "https://contoh.test/2026-08/orphan",
    }),
    fixture({
      orgId: ORG_S2,
      branchId: BRANCH_A2,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-07-09T04:00:00.000Z"),
      dateCreated: "2026-07-09",
      platform: "LAINNYA",
      contentType: null,
      mainTheme: "EDUFAST",
      subTheme: "KORPORAT",
      title: "Tanpa jenis konten",
      url: "https://contoh.test/2026-07/typeless",
    }),
  );

  // Duplicate URL pair: ingestion dedupes, analytics must count stored rows.
  const duplicateUrl = "https://contoh.test/duplikat/sama";
  rows.push(
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-06-15T03:00:00.000Z"),
      dateCreated: "2026-06-15",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Duplikat A",
      url: duplicateUrl,
    }),
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-06-16T03:00:00.000Z"),
      dateCreated: "2026-06-16",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Duplikat B",
      url: duplicateUrl,
    }),
  );

  // Excluded from approved analytics: archived, null timestamp, revoked, old.
  rows.push(
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2026-07-21T03:00:00.000Z"),
      dateCreated: "2026-07-21",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      archived: true,
      title: "Arsip",
      url: "https://contoh.test/2026-07/archived",
    }),
    fixture({
      orgId: ORG_S2,
      branchId: BRANCH_A2,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: null,
      dateCreated: "2026-07-22",
      platform: "FACEBOOK",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Disetujui tanpa stempel",
      url: "https://contoh.test/2026-07/null-approved",
    }),
    fixture({
      orgId: ORG_S3,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "REVOKED",
      approvedAt: new Date("2026-08-05T03:00:00.000Z"),
      dateCreated: "2026-08-05",
      platform: "WEBSITE",
      contentType: "INFOGRAFIS",
      mainTheme: "NON_EDUFAST",
      subTheme: "INFORMASI",
      title: "Dicabut",
      url: "https://contoh.test/2026-08/revoked",
    }),
    fixture({
      orgId: ORG_S1,
      branchId: BRANCH_A1,
      regionId: REGION_A,
      status: "APPROVED",
      approvedAt: new Date("2023-09-15T03:00:00.000Z"),
      dateCreated: "2023-09-15",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Di luar jendela tren",
      url: "https://contoh.test/2023-09/old",
    }),
    fixture({
      orgId: ORG_S4,
      branchId: BRANCH_B1,
      regionId: REGION_B,
      status: "REVOKED",
      approvedAt: new Date("2026-10-09T03:00:00.000Z"),
      dateCreated: "2026-10-09",
      platform: "TIKTOK",
      contentType: "VIDEO",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      title: "Dicabut luar wilayah",
      url: "https://contoh.test/2026-10/revoked-b",
    }),
  );

  return rows;
}

function user(
  id: string,
  role: AppRole,
  scope: Scope,
  scopeLabel: string,
): SessionUser {
  return {
    id,
    name: `Backtest ${role}`,
    email: `${id}@example.test`,
    role,
    scope,
    capabilities: capabilitiesForRole(role),
    membershipId: `membership-${id}`,
    isDemo: true,
    mustChangePassword: false,
    locationStatus: "VERIFIED",
    locationGraceDeadline: null,
    active: true,
    displayTitle: null,
    homePath: "/",
    scopeLabel,
    stakeholderIds: scope.kind === "ORG" ? [scope.organizationId] : [],
  };
}

const master = user(MASTER_ID, "MASTER_ADMIN", { kind: "GLOBAL" }, "Nasional");
const regional = user(
  REGIONAL_ID,
  "REGIONAL_ADMIN",
  {
    kind: "REGION",
    regionId: REGION_A,
    branchIds: [BRANCH_A1, BRANCH_A2],
    regionName: "Wilayah A",
  },
  "Wilayah A",
);
const branch = user(
  BRANCH_ID,
  "BRANCH_ADMIN",
  {
    kind: "BRANCH",
    branchId: BRANCH_A1,
    regionId: REGION_A,
    branchName: "Cabang A1",
    regionName: "Wilayah A",
  },
  "Cabang A1",
);
const stakeholder = user(
  STAKEHOLDER_ID,
  "STAKEHOLDER",
  {
    kind: "ORG",
    organizationId: ORG_S1,
    organizationName: "Klinik Sehat A1",
    branchId: BRANCH_A1,
    branchName: "Cabang A1",
    regionId: REGION_A,
    regionName: "Wilayah A",
  },
  "Klinik Sehat A1",
);

function organizationIdsForScope(scope: Scope): string[] | null {
  if (scope.kind === "GLOBAL") return null;
  if (scope.kind === "ORG") return [scope.organizationId];
  if (scope.kind === "BRANCH") {
    return ORGS.filter((org) => org.branchId === scope.branchId).map(
      (org) => org.id,
    );
  }
  return ORGS.filter((org) => scope.branchIds.includes(org.branchId)).map(
    (org) => org.id,
  );
}

async function scalar(text: string, params: unknown[] = []): Promise<number> {
  const result = await client.query<{ total: number }>(text, params);
  return Number(result.rows[0]?.total ?? 0);
}

async function rawApprovedCount(scope: Scope, extra = ""): Promise<number> {
  const orgIds = organizationIdsForScope(scope);
  const params: unknown[] = [];
  let where = `s.archived = false and s.status = 'APPROVED' and s.approved_at is not null`;
  if (orgIds) {
    params.push(orgIds);
    where += ` and s.stakeholder_id = any($${params.length}::uuid[])`;
  }
  if (extra) where += ` and ${extra}`;
  return scalar(
    `select count(*)::int as total from content_submissions s where ${where}`,
    params,
  );
}

async function rawCount(
  where: string,
  params: unknown[] = [],
): Promise<number> {
  return scalar(
    `select count(*)::int as total from content_submissions s where ${where}`,
    params,
  );
}

function defaultApprovedFilters(): AnalyticsContentFilters {
  return {
    period: "ALL",
    periodBasis: "approved",
    status: "ALL",
    scope: "approved",
    sources: [],
    decidedBy: "ANY",
    sort: "approved_recent",
    search: "",
    page: 1,
  };
}

function defaultAllFilters(): AnalyticsContentFilters {
  return {
    period: "ALL",
    periodBasis: "created",
    status: "ALL",
    scope: "all",
    sources: [],
    decidedBy: "ANY",
    sort: "recent",
    search: "",
    page: 1,
  };
}

function slaFilters(): SlaFilters {
  return {
    period: "2026-10",
    orgType: null,
    mainTheme: null,
    subTheme: null,
    search: "",
    page: 1,
  };
}

async function seed(): Promise<void> {
  client = new PGlite();
  for (const file of MIGRATIONS) {
    await client.exec(
      readFileSync(join(process.cwd(), "drizzle", file), "utf8"),
    );
  }
  // The analytics services call getDb(); point the singleton at this PGlite.
  (globalThis as unknown as { __dakostaDb?: unknown }).__dakostaDb = drizzle(
    client,
    { schema },
  );

  for (const [index, id] of [
    MASTER_ID,
    REGIONAL_ID,
    BRANCH_ID,
    STAKEHOLDER_ID,
  ].entries()) {
    await client.query(
      `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
       values ($1, $2, $3, true, 'user', now(), now())`,
      [id, `Backtest ${index}`, `${id}@example.test`],
    );
  }

  for (const region of [
    { id: REGION_A, code: "BT-REG-A", name: "Wilayah A" },
    { id: REGION_B, code: "BT-REG-B", name: "Wilayah B" },
  ]) {
    await client.query(
      `insert into regional_offices (id, code, name, status)
       values ($1::uuid, $2, $3, 'ACTIVE')`,
      [region.id, region.code, region.name],
    );
  }

  for (const branchOffice of [
    { id: BRANCH_A1, regionId: REGION_A, code: "BT-A1", name: "Cabang A1" },
    { id: BRANCH_A2, regionId: REGION_A, code: "BT-A2", name: "Cabang A2" },
    { id: BRANCH_B1, regionId: REGION_B, code: "BT-B1", name: "Cabang B1" },
  ]) {
    await client.query(
      `insert into branch_offices (id, regional_office_id, code, name, status)
       values ($1::uuid, $2::uuid, $3, $4, 'ACTIVE')`,
      [
        branchOffice.id,
        branchOffice.regionId,
        branchOffice.code,
        branchOffice.name,
      ],
    );
  }

  let locationSeq = 0;
  for (const org of ORGS) {
    locationSeq += 1;
    const locationId = uuid("d0", locationSeq);
    await client.query(
      `insert into stakeholders
         (id, name, category, organization_type, faskes_class, faskes_code,
          faskes_code_normalized, service_area, latitude, longitude, status,
          joined_at, branch_office_id)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, 'Bandung', $8, $9, 'ACTIVE',
         '2025-01-01', $10::uuid)`,
      [
        org.id,
        org.name,
        org.category,
        org.type,
        org.faskesClass,
        org.faskesCode,
        org.faskesCode ? org.faskesCode.toLowerCase() : null,
        org.latitude,
        org.longitude,
        org.branchId,
      ],
    );
    await client.query(
      `insert into locations
         (id, stakeholder_id, latitude, longitude, label, source, verified_status, precision)
       values ($1::uuid, $2::uuid, $3, $4, $5, 'manual_pin', 'VERIFIED', 'exact')`,
      [locationId, org.id, org.latitude, org.longitude, `Lokasi ${org.name}`],
    );
  }

  const fixtures = buildFixtures();
  const locationByOrg = new Map<string, string>();
  for (const [index, org] of ORGS.entries()) {
    locationByOrg.set(org.id, uuid("d0", index + 1));
  }

  for (const row of fixtures) {
    const hash = createHash("sha256").update(row.url).digest("hex");
    await client.query(
      `insert into content_submissions
         (id, reference_code, stakeholder_id, created_by, submitted_by, title,
          narrative, published_url, normalized_url, normalized_url_hash, platform,
          content_type, main_theme, sub_theme, date_created, location_id,
          branch_office_id, regional_office_id, status, idempotency_key,
          submitted_at, approved_at, archived)
       values ($1::uuid, $2, $3::uuid, $4, $4, $5, $6, $7, $7, $8, $9, $10,
         $11, $12, $13, $14::uuid, $15::uuid, $16::uuid, $17, $2,
         $18, $19, $20)`,
      [
        row.id,
        row.reference,
        row.orgId,
        MASTER_ID,
        row.title,
        `Narasi sintetis ${row.title}`,
        row.url,
        hash,
        row.platform,
        row.contentType,
        row.mainTheme,
        row.subTheme,
        row.dateCreated,
        locationByOrg.get(row.orgId),
        row.branchId,
        row.regionId,
        row.status,
        row.approvedAt
          ? new Date(row.approvedAt.getTime() - 3 * 86_400_000)
          : new Date(`${row.dateCreated}T03:00:00.000Z`),
        row.approvedAt,
        row.archived ?? false,
      ],
    );
  }
}

async function reconcileDashboard(): Promise<void> {
  const filters = {
    table: defaultApprovedFilters(),
    rankingSearch: "",
    rankingLimit: 10,
  };
  const dashboard = await getApprovedDashboard(master, filters);
  const approved = await rawApprovedCount(master.scope);

  console.log("\n-- Dashboard (Master) --");
  expectEqual(
    "dashboard totals.approved = SQL approved",
    dashboard.totals.approved,
    approved,
  );
  expectEqual(
    "dashboard table.total = SQL approved",
    dashboard.table.total,
    approved,
  );
  expectEqual(
    "ranking categories sum = approved total",
    dashboard.ranking.categories.reduce((sum, row) => sum + row.approved, 0),
    approved,
  );
  const rankingSum = dashboard.ranking.rows.reduce(
    (sum, row) => sum + row.approved,
    0,
  );
  check(
    "ranking rows are a subset of approved",
    rankingSum <= approved,
    `rows=${rankingSum}`,
  );
  check(
    "ranking positions are tie-aware and descending",
    dashboard.ranking.rows.every((row, index, rows) => {
      const previous = rows[index - 1];
      const ordered = !previous || previous.approved >= row.approved;
      const expectedRank =
        previous && previous.approved === row.approved
          ? previous.rank
          : index + 1;
      return ordered && row.rank === expectedRank;
    }),
    `${dashboard.ranking.rows.length} rows`,
  );

  const rawByOrg = await client.query<{
    stakeholder_id: string;
    total: number;
  }>(
    `select stakeholder_id, count(*)::int as total
       from content_submissions
      where archived = false and status = 'APPROVED' and approved_at is not null
      group by stakeholder_id`,
  );
  const rawOrgTotals = new Map(
    rawByOrg.rows.map((row) => [row.stakeholder_id, Number(row.total)]),
  );
  check(
    "ranking row counts match SQL per organization",
    dashboard.ranking.rows.every(
      (row) => row.approved === (rawOrgTotals.get(row.id) ?? 0),
    ),
  );

  // Monthly window, zero-fill, and Asia/Jakarta bucketing.
  const windowKeys: string[] = [monthKeyFor()];
  for (let index = 1; index < DASHBOARD_TREND_MONTHS; index += 1) {
    windowKeys.push(previousMonthKey(windowKeys[windowKeys.length - 1]!));
  }
  windowKeys.reverse();
  expectEqual(
    "monthly trend has one zero-filled bucket per month",
    dashboard.monthly.length,
    DASHBOARD_TREND_MONTHS,
  );
  check(
    "monthly buckets are chronological",
    dashboard.monthly.every(
      (point, index) => point.month === windowKeys[index],
    ),
  );
  check(
    "monthly trend includes empty months as zero",
    dashboard.monthly
      .filter((point) => point.month < MONTH_KEYS[0]!)
      .every((point) => point.total === 0),
  );

  const expectedByMonth = new Map<string, number>();
  const approvedRows = await client.query<{
    approved_at: Date;
  }>(
    `select approved_at from content_submissions
      where archived = false and status = 'APPROVED' and approved_at is not null`,
  );
  for (const row of approvedRows.rows) {
    const key = jakartaMonth(new Date(row.approved_at));
    expectedByMonth.set(key, (expectedByMonth.get(key) ?? 0) + 1);
  }
  check(
    "monthly counts use the Asia/Jakarta boundary",
    dashboard.monthly.every(
      (point) => point.total === (expectedByMonth.get(point.month) ?? 0),
    ),
    dashboard.monthly.map((p) => `${p.month}:${p.total}`).join(" "),
  );

  const windowStart = monthRange(windowKeys[0]!).startInstant;
  const windowEnd = monthRange(windowKeys[windowKeys.length - 1]!).endInstant;
  const rawWindow = await scalar(
    `select count(*)::int as total from content_submissions
      where archived = false and status = 'APPROVED'
        and approved_at >= $1 and approved_at <= $2`,
    [windowStart, windowEnd],
  );
  expectEqual(
    "monthly trend sum = SQL approved inside the window",
    dashboard.monthly.reduce((sum, point) => sum + point.total, 0),
    rawWindow,
  );

  const themeSum = dashboard.theme.monthly.reduce(
    (sum, point) => sum + point.edufast + point.nonEdufast,
    0,
  );
  expectEqual("theme trend sum = monthly total", themeSum, rawWindow);
  expectEqual(
    "sub-theme breakdown sum = monthly total",
    dashboard.theme.subThemes.reduce((sum, row) => sum + row.total, 0),
    rawWindow,
  );
  check(
    "orphan sub-theme is reported instead of dropped",
    dashboard.theme.orphanTotal > 0 &&
      dashboard.theme.subThemes.some((row) => row.orphan && row.total > 0),
    `orphan=${dashboard.theme.orphanTotal}`,
  );

  const typeSum = dashboard.typePlatform.types.reduce(
    (sum, row) => sum + row.total,
    0,
  );
  const platformSum = dashboard.typePlatform.platforms.reduce(
    (sum, row) => sum + row.total,
    0,
  );
  expectEqual("content-type breakdown sum = monthly total", typeSum, rawWindow);
  expectEqual(
    "platform breakdown counts each row once",
    platformSum,
    rawWindow,
  );
  check(
    "platform legend keys are explicit",
    dashboard.typePlatform.platforms.every(
      (row) => row.key === "TANPA_PLATFORM" || PLATFORMS.includes(row.key),
    ),
  );

  check(
    "map approved total = dashboard approved total",
    dashboard.map.totals.approved === dashboard.totals.approved,
    `${dashboard.map.totals.approved} vs ${dashboard.totals.approved}`,
  );

  // Detail Konten approved mode and PDF input parity.
  const approvedTable = await listAnalyticsContents(
    master,
    defaultApprovedFilters(),
  );
  expectEqual(
    "Detail Konten approved total = dashboard approved total",
    approvedTable.total,
    dashboard.totals.approved,
  );
  const reportPage = await listAnalyticsContents(master, {
    ...defaultApprovedFilters(),
    page: 1,
    pageSize: CONTENT_REPORT_ROW_CAP,
  });
  expectEqual(
    "PDF report row count = min(total, cap)",
    reportPage.rows.length,
    Math.min(approved, CONTENT_REPORT_ROW_CAP),
  );
  const csvEquivalent = await rawCount(
    `s.archived = false and s.status = 'APPROVED' and s.approved_at is not null`,
  );
  expectEqual(
    "CSV query (same filters) = dashboard approved total",
    csvEquivalent,
    dashboard.totals.approved,
  );

  const instagram = await listAnalyticsContents(master, {
    ...defaultApprovedFilters(),
    platform: "INSTAGRAM",
  });
  const rawInstagram = await rawApprovedCount(
    master.scope,
    `s.platform = 'INSTAGRAM'`,
  );
  expectEqual(
    "platform filter reconciles with SQL",
    instagram.total,
    rawInstagram,
  );

  const faskes = await listAnalyticsContents(master, {
    ...defaultApprovedFilters(),
    orgType: "FASKES",
  });
  const rawFaskes = await rawCount(
    `s.archived = false and s.status = 'APPROVED' and s.approved_at is not null
       and s.stakeholder_id in (select id from stakeholders where organization_type = 'FASKES')`,
  );
  expectEqual("org-type filter reconciles with SQL", faskes.total, rawFaskes);

  const ranged = await listAnalyticsContents(master, {
    ...defaultApprovedFilters(),
    dateFrom: "2026-10-01",
    dateTo: "2026-10-31",
  });
  const rawRanged = await rawApprovedCount(
    master.scope,
    `s.approved_at >= '2026-09-30T17:00:00Z' and s.approved_at < '2026-10-31T17:00:00Z'`,
  );
  expectEqual("approval date range uses Jakarta days", ranged.total, rawRanged);

  const allStatuses = await listAnalyticsContents(master, defaultAllFilters());
  const rawAll = await rawCount(`s.archived = false`);
  expectEqual(
    "Detail Konten all-status total = SQL",
    allStatuses.total,
    rawAll,
  );
  check(
    "Detail Konten all-status includes non-approved rows",
    allStatuses.total > approvedTable.total,
    `${allStatuses.total} > ${approvedTable.total}`,
  );

  // Scope isolation for the same filters.
  for (const [label, viewer] of [
    ["regional", regional],
    ["branch", branch],
    ["stakeholder", stakeholder],
  ] as const) {
    const scoped = await getApprovedDashboard(viewer, {
      table: defaultApprovedFilters(),
      rankingSearch: "",
      rankingLimit: 10,
    });
    const rawScoped = await rawApprovedCount(viewer.scope);
    expectEqual(
      `${label} dashboard total = scoped SQL approved`,
      scoped.totals.approved,
      rawScoped,
    );
    check(
      `${label} dashboard is narrower than national`,
      scoped.totals.approved < dashboard.totals.approved,
      `${scoped.totals.approved} < ${dashboard.totals.approved}`,
    );
    expectEqual(
      `${label} trend sum = scoped SQL inside window`,
      scoped.monthly.reduce((sum, point) => sum + point.total, 0),
      await scalar(
        `select count(*)::int as total from content_submissions s
          where s.archived = false and s.status = 'APPROVED'
            and s.approved_at >= $1 and s.approved_at <= $2
            and s.stakeholder_id = any($3::uuid[])`,
        [windowStart, windowEnd, organizationIdsForScope(viewer.scope)],
      ),
    );
  }
}

async function reconcileSla(): Promise<void> {
  console.log("\n-- SLA (all statuses, period 2026-10) --");
  const sla = await getSlaAnalytics(master, slaFilters());
  const periodWhere = `s.archived = false and s.date_created >= '2026-10-01' and s.date_created <= '2026-10-31'`;
  const rawPeriod = await rawCount(periodWhere);
  expectEqual(
    "SLA submitted = SQL rows created in the period",
    sla.summary.submitted,
    rawPeriod,
  );
  expectEqual(
    "SLA status composition sums to submitted",
    sla.statusCounts.reduce((sum, row) => sum + row.total, 0),
    sla.summary.submitted,
  );
  expectEqual(
    "SLA approved count = SQL APPROVED created in the period",
    sla.summary.approved,
    await rawCount(`${periodWhere} and s.status = 'APPROVED'`),
  );
  expectEqual(
    "SLA pending = SQL pending statuses in the period",
    sla.summary.pending,
    await rawCount(
      `${periodWhere} and s.status in ('SUBMITTED', 'RESUBMITTED', 'IN_REVIEW')`,
    ),
  );

  const slaFaskes = await getSlaAnalytics(master, {
    ...slaFilters(),
    orgType: "FASKES",
  });
  const rawFaskes = await rawCount(
    `${periodWhere} and s.stakeholder_id in (select id from stakeholders where organization_type = 'FASKES')`,
  );
  expectEqual(
    "SLA org-type filter reconciles with SQL",
    slaFaskes.summary.submitted,
    rawFaskes,
  );

  const slaRegional = await getSlaAnalytics(regional, slaFilters());
  const regionalOrgIds = organizationIdsForScope(regional.scope)!;
  const rawRegional = await rawCount(
    `${periodWhere} and s.stakeholder_id = any($1::uuid[])`,
    [regionalOrgIds],
  );
  expectEqual(
    "regional SLA is scope-bound",
    slaRegional.summary.submitted,
    rawRegional,
  );
  check(
    "regional SLA excludes other regions",
    slaRegional.summary.submitted < sla.summary.submitted,
  );

  const slaBranch = await getSlaAnalytics(branch, slaFilters());
  const rawBranch = await rawCount(
    `${periodWhere} and s.stakeholder_id = any($1::uuid[])`,
    [organizationIdsForScope(branch.scope)!],
  );
  expectEqual(
    "branch SLA is scope-bound",
    slaBranch.summary.submitted,
    rawBranch,
  );
}

async function main(): Promise<void> {
  console.log(
    "Backtest reconcile — synthetic fixtures, real analytics services",
  );
  console.log(
    `Calendar today: ${new Date().toISOString()} (Jakarta ${monthKeyFor()})`,
  );
  await seed();

  try {
    await reconcileDashboard();
    await reconcileSla();
  } finally {
    await client.close();
  }

  const failed = checks.filter((entry) => !entry.ok);
  const total = checks.length;
  const passed = total - failed.length;

  const evidenceDir = join(process.cwd(), "docs", "audit", "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, "r13-backtest-reconcile.json");
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        jakartaMonth: monthKeyFor(),
        fixtures: fixtureSeq,
        total,
        passed,
        failed: failed.length,
        checks,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n${passed}/${total} checks passed`);
  console.log(`Evidence: ${evidencePath}`);
  if (failed.length > 0) {
    for (const entry of failed) {
      console.error(`FAILED: ${entry.name} — ${entry.detail}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
