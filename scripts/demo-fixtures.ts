import { SUB_THEMES, shiftPeriod, type SubTheme } from "../src/lib/taxonomy";
import { normalizePublishedUrl } from "../src/lib/url";
import { detectPii } from "../src/lib/validation/content";

/**
 * Pure, deterministic fixtures for the production demo dataset. This module
 * has no environment or database side effects so it can be imported by tests.
 * Every expected count is derived from the arrays below — never hand-written.
 */

export const DEMO_DOMAIN = "demo.dakosta.local";
export const DEMO_SEED_VERSION = "demo-seed-v2";
const DAY_MS = 86_400_000;

export type DemoVolume = {
  months: number;
  slotsPerOrgMonth: number;
};

export const DEMO_VOLUME: DemoVolume = { months: 24, slotsPerOrgMonth: 5 };
export const DEMO_VOLUME_TEST: DemoVolume = { months: 3, slotsPerOrgMonth: 5 };

export function demoSubmissionsPerMonth(
  volume: DemoVolume = DEMO_VOLUME,
): number {
  return DEMO_ORGANIZATIONS.length * volume.slotsPerOrgMonth;
}

export function demoSubmissionTotal(volume: DemoVolume = DEMO_VOLUME): number {
  return volume.months * demoSubmissionsPerMonth(volume);
}

export function demoTargetTotal(volume: DemoVolume = DEMO_VOLUME): number {
  return volume.months * (1 + SUB_THEMES.length + DEMO_ORGANIZATIONS.length);
}

export type DemoStatus =
  "DRAFT" | "SUBMITTED" | "REVISION_REQUIRED" | "APPROVED";

export type DemoRole =
  "MASTER_ADMIN" | "REGIONAL_ADMIN" | "BRANCH_ADMIN" | "STAKEHOLDER";

export type DemoReviewAction =
  "APPROVE" | "REQUEST_REVISION" | "REJECT" | "REVOKE";

const ID_PREFIX = {
  user: "00000000",
  organization: "10000000",
  submission: "20000000",
  notification: "30000000",
  location: "40000000",
  theme: "50000000",
  roleMembership: "60000000",
  membership: "70000000",
  stakeholderMembership: "71000000",
  target: "80000000",
  review: "90000000",
  revision: "a0000000",
  audit: "b0000000",
  account: "c0000000",
  region: "d0000000",
  outbox: "de000000",
  branch: "e0000000",
  policy: "f0000000",
  policyEvent: "f1000000",
} as const;

export function demoId(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export const DEMO_IDS = {
  user: (n: number) => demoId(ID_PREFIX.user, n),
  organization: (n: number) => demoId(ID_PREFIX.organization, n),
  submission: (n: number) => demoId(ID_PREFIX.submission, n),
  notification: (n: number) => demoId(ID_PREFIX.notification, n),
  location: (n: number) => demoId(ID_PREFIX.location, n),
  theme: (n: number) => demoId(ID_PREFIX.theme, n),
  roleMembership: (n: number) => demoId(ID_PREFIX.roleMembership, n),
  membership: (n: number) => demoId(ID_PREFIX.membership, n),
  stakeholderMembership: (n: number) =>
    demoId(ID_PREFIX.stakeholderMembership, n),
  target: (n: number) => demoId(ID_PREFIX.target, n),
  review: (n: number) => demoId(ID_PREFIX.review, n),
  revision: (n: number) => demoId(ID_PREFIX.revision, n),
  audit: (n: number) => demoId(ID_PREFIX.audit, n),
  account: (n: number) => demoId(ID_PREFIX.account, n),
  region: (n: number) => demoId(ID_PREFIX.region, n),
  outbox: (n: number) => demoId(ID_PREFIX.outbox, n),
  branch: (n: number) => demoId(ID_PREFIX.branch, n),
  policy: (n: number) => demoId(ID_PREFIX.policy, n),
  policyEvent: (n: number) => demoId(ID_PREFIX.policyEvent, n),
} as const;

export type DemoRegion = {
  n: number;
  code: string;
  name: string;
};

export type DemoBranch = {
  n: number;
  regionN: number;
  code: string;
  name: string;
};

export type DemoOrganization = {
  n: number;
  branchN: number;
  name: string;
  organizationType: "FASKES" | "PEMDA" | "OTHER";
  faskesClass: "FKTP" | "FKRTL" | null;
  faskesCode: string | null;
  category:
    "FASKES" | "INSTANSI" | "MEDIA" | "INFLUENCER" | "ORGANISASI" | "TOKOH";
  serviceArea: string;
  addressLabel: string;
  latitude: number;
  longitude: number;
};

export type DemoAccount = {
  n: number;
  email: string;
  name: string;
  title: string;
  role: DemoRole;
  regionN: number | null;
  branchN: number | null;
  organizationN: number | null;
};

export type DemoTheme = {
  n: number;
  slug: string;
  name: string;
  description: string;
};

export type DemoPolicy = {
  n: number;
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  explanation: string;
  createdAt: Date;
  publishedAt: Date;
};

export type DemoPolicyEvent = {
  n: number;
  id: string;
  policyN: number;
  action: "CREATED" | "PUBLISHED";
  snapshot: Record<string, unknown>;
  createdAt: Date;
};

export type DemoSubmission = {
  n: number;
  id: string;
  referenceCode: string;
  organizationN: number;
  regionN: number;
  branchN: number;
  authorAccountN: number;
  reviewerAccountN: number | null;
  title: string;
  narrative: string;
  publishedUrl: string;
  normalizedUrl: string;
  normalizedUrlHash: string;
  platform: string;
  contentType: "VIDEO" | "INFOGRAFIS";
  mainTheme: "EDUFAST" | "NON_EDUFAST";
  subTheme: SubTheme;
  themeSlug: string;
  period: string;
  dateCreated: string;
  publishedAt: string | null;
  status: DemoStatus;
  version: number;
  resubmissionCount: number;
  submittedAt: Date | null;
  approvedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  decisionReason: string | null;
  archived: boolean;
  approvedSnapshot: Record<string, unknown> | null;
  approvedVersion: number | null;
  edufastPolicyN: number | null;
  edufastPolicyVersion: number | null;
  idempotencyKey: string;
};

export type DemoLocation = {
  n: number;
  id: string;
  submissionN: number;
  latitude: number;
  longitude: number;
  label: string;
  source: "device_gps" | "manual_pin";
  accuracyMeters: number | null;
  consentAt: Date | null;
  verifiedStatus: "VERIFIED" | "MANUAL_UNVERIFIED";
  precision: "exact" | "approximate";
  createdAt: Date;
};

export type DemoRevision = {
  n: number;
  id: string;
  submissionN: number;
  version: number;
  snapshot: Record<string, unknown>;
  actorAccountN: number;
  reason: string | null;
  createdAt: Date;
};

export type DemoReview = {
  n: number;
  id: string;
  submissionN: number;
  version: number;
  reviewerAccountN: number;
  action: DemoReviewAction;
  checklist: Record<string, boolean>;
  notes: string | null;
  previousStatus: string;
  nextStatus: string;
  reviewerRole: "BRANCH_ADMIN";
  createdAt: Date;
};

export type DemoTarget = {
  n: number;
  id: string;
  workspaceLabel: string;
  organizationN: number | null;
  subTheme: SubTheme | null;
  period: string;
  periodStart: string;
  periodEnd: string;
  targetCount: number;
  createdAt: Date;
};

export type DemoNotification = {
  n: number;
  id: string;
  recipientAccountN: number;
  eventType: string;
  title: string;
  body: string;
  objectType: string;
  objectId: string;
  href: string;
  branchN: number | null;
  organizationN: number | null;
  readAt: Date | null;
  dedupeKey: string;
  createdAt: Date;
};

export type DemoOutbox = {
  n: number;
  id: string;
  notificationN: number;
  eventKey: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  recipientAccountN: number;
  processedAt: Date;
  createdAt: Date;
};

export type DemoAudit = {
  n: number;
  id: string;
  actorAccountN: number;
  actorRole: DemoRole;
  action: string;
  recordType: string;
  recordId: string;
  regionN: number | null;
  branchN: number | null;
  organizationN: number | null;
  after: Record<string, unknown> | null;
  source: "SEED";
  createdAt: Date;
};

export const DEMO_REGIONS: readonly DemoRegion[] = [
  { n: 1, code: "REG-DEMO-JB", name: "Wilayah Jawa Barat" },
  { n: 2, code: "REG-DEMO-DKI", name: "Wilayah DKI Jakarta" },
  { n: 3, code: "REG-DEMO-JTM", name: "Wilayah Jawa Timur" },
];

export const DEMO_BRANCHES: readonly DemoBranch[] = [
  { n: 1, regionN: 1, code: "CBG-DEMO-BDG-KOTA", name: "Cabang Bandung Kota" },
  {
    n: 2,
    regionN: 1,
    code: "CBG-DEMO-BDG-KAB",
    name: "Cabang Kabupaten Bandung",
  },
  { n: 3, regionN: 1, code: "CBG-DEMO-BEKASI", name: "Cabang Bekasi" },
  { n: 4, regionN: 2, code: "CBG-DEMO-JKT-PST", name: "Cabang Jakarta Pusat" },
  { n: 5, regionN: 2, code: "CBG-DEMO-JKT-UTR", name: "Cabang Jakarta Utara" },
  {
    n: 6,
    regionN: 2,
    code: "CBG-DEMO-JKT-SEL",
    name: "Cabang Jakarta Selatan",
  },
  { n: 7, regionN: 3, code: "CBG-DEMO-SBY", name: "Cabang Surabaya" },
  { n: 8, regionN: 3, code: "CBG-DEMO-MLG", name: "Cabang Malang" },
];

export const DEMO_ORGANIZATIONS: readonly DemoOrganization[] = [
  {
    n: 1,
    branchN: 1,
    name: "Klinik Sehat Nusantara",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JB01",
    category: "FASKES",
    serviceArea: "Kecamatan Sumur Bandung",
    addressLabel: "Klinik Sehat Nusantara, Bandung",
    latitude: -6.9147,
    longitude: 107.6098,
  },
  {
    n: 2,
    branchN: 1,
    name: "Puskesmas Cahaya Sehat",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JB02",
    category: "FASKES",
    serviceArea: "Kecamatan Coblong",
    addressLabel: "Puskesmas Cahaya Sehat, Bandung",
    latitude: -6.8975,
    longitude: 107.6102,
  },
  {
    n: 3,
    branchN: 1,
    name: "Klinik Mitra Bunda",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JB03",
    category: "FASKES",
    serviceArea: "Kecamatan Lengkong",
    addressLabel: "Klinik Mitra Bunda, Bandung",
    latitude: -6.9331,
    longitude: 107.5842,
  },
  {
    n: 4,
    branchN: 2,
    name: "RSUD Kabupaten Bandung",
    organizationType: "FASKES",
    faskesClass: "FKRTL",
    faskesCode: "DEMO-FKRTL-JB01",
    category: "FASKES",
    serviceArea: "Kecamatan Soreang",
    addressLabel: "RSUD Kabupaten Bandung, Soreang",
    latitude: -6.9552,
    longitude: 107.5121,
  },
  {
    n: 5,
    branchN: 2,
    name: "Klinik Amanah Farma",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JB05",
    category: "FASKES",
    serviceArea: "Kecamatan Margahayu",
    addressLabel: "Klinik Amanah Farma, Kabupaten Bandung",
    latitude: -6.9589,
    longitude: 107.5712,
  },
  {
    n: 6,
    branchN: 2,
    name: "Media Kesehatan Bandung",
    organizationType: "OTHER",
    faskesClass: null,
    faskesCode: null,
    category: "MEDIA",
    serviceArea: "Kabupaten Bandung",
    addressLabel: "Media Kesehatan Bandung",
    latitude: -6.921,
    longitude: 107.541,
  },
  {
    n: 7,
    branchN: 3,
    name: "Laboratorium Prima Diagnostik",
    organizationType: "FASKES",
    faskesClass: "FKRTL",
    faskesCode: "DEMO-FKRTL-JB02",
    category: "FASKES",
    serviceArea: "Kecamatan Bekasi Utara",
    addressLabel: "Laboratorium Prima Diagnostik, Bekasi",
    latitude: -6.2383,
    longitude: 107.0,
  },
  {
    n: 8,
    branchN: 3,
    name: "Organisasi Peduli Sehat",
    organizationType: "OTHER",
    faskesClass: null,
    faskesCode: null,
    category: "ORGANISASI",
    serviceArea: "Kota Bekasi",
    addressLabel: "Organisasi Peduli Sehat, Bekasi",
    latitude: -6.2649,
    longitude: 106.9896,
  },
  {
    n: 9,
    branchN: 3,
    name: "Puskesmas Cimahi Tengah",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JB04",
    category: "FASKES",
    serviceArea: "Kecamatan Cimahi Tengah",
    addressLabel: "Puskesmas Cimahi Tengah",
    latitude: -6.8722,
    longitude: 107.5425,
  },
  {
    n: 10,
    branchN: 4,
    name: "Puskesmas Jakarta Pusat",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-DKI01",
    category: "FASKES",
    serviceArea: "Kecamatan Gambir",
    addressLabel: "Puskesmas Jakarta Pusat",
    latitude: -6.1767,
    longitude: 106.8272,
  },
  {
    n: 11,
    branchN: 4,
    name: "Dinas Kesehatan DKI Jakarta",
    organizationType: "PEMDA",
    faskesClass: null,
    faskesCode: null,
    category: "INSTANSI",
    serviceArea: "Provinsi DKI Jakarta",
    addressLabel: "Dinas Kesehatan DKI Jakarta",
    latitude: -6.1751,
    longitude: 106.8272,
  },
  {
    n: 12,
    branchN: 4,
    name: "Klinik Sehat Bersama",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-DKI02",
    category: "FASKES",
    serviceArea: "Kecamatan Tanah Abang",
    addressLabel: "Klinik Sehat Bersama, Jakarta Pusat",
    latitude: -6.1897,
    longitude: 106.8112,
  },
  {
    n: 13,
    branchN: 5,
    name: "RSUD Jakarta Utara",
    organizationType: "FASKES",
    faskesClass: "FKRTL",
    faskesCode: "DEMO-FKRTL-DKI01",
    category: "FASKES",
    serviceArea: "Kecamatan Koja",
    addressLabel: "RSUD Jakarta Utara",
    latitude: -6.1214,
    longitude: 106.8892,
  },
  {
    n: 14,
    branchN: 5,
    name: "Puskesmas Kelapa Gading",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-DKI03",
    category: "FASKES",
    serviceArea: "Kecamatan Kelapa Gading",
    addressLabel: "Puskesmas Kelapa Gading",
    latitude: -6.1621,
    longitude: 106.9056,
  },
  {
    n: 15,
    branchN: 5,
    name: "Jurnal Sehat Jakarta",
    organizationType: "OTHER",
    faskesClass: null,
    faskesCode: null,
    category: "MEDIA",
    serviceArea: "Jakarta Utara",
    addressLabel: "Jurnal Sehat Jakarta",
    latitude: -6.1418,
    longitude: 106.8752,
  },
  {
    n: 16,
    branchN: 6,
    name: "Klinik Jakarta Selatan Sehat",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-DKI04",
    category: "FASKES",
    serviceArea: "Kecamatan Kebayoran Baru",
    addressLabel: "Klinik Jakarta Selatan Sehat",
    latitude: -6.2437,
    longitude: 106.7992,
  },
  {
    n: 17,
    branchN: 6,
    name: "Komunitas Peduli Gizi",
    organizationType: "OTHER",
    faskesClass: null,
    faskesCode: null,
    category: "ORGANISASI",
    serviceArea: "Jakarta Selatan",
    addressLabel: "Komunitas Peduli Gizi",
    latitude: -6.2615,
    longitude: 106.8106,
  },
  {
    n: 18,
    branchN: 7,
    name: "RSUD Dr. Soetomo Surabaya",
    organizationType: "FASKES",
    faskesClass: "FKRTL",
    faskesCode: "DEMO-FKRTL-JTM01",
    category: "FASKES",
    serviceArea: "Kecamatan Gubeng",
    addressLabel: "RSUD Dr. Soetomo, Surabaya",
    latitude: -7.2575,
    longitude: 112.7476,
  },
  {
    n: 19,
    branchN: 7,
    name: "Puskesmas Surabaya Timur",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JTM01",
    category: "FASKES",
    serviceArea: "Kecamatan Mulyorejo",
    addressLabel: "Puskesmas Surabaya Timur",
    latitude: -7.2692,
    longitude: 112.7836,
  },
  {
    n: 20,
    branchN: 8,
    name: "Puskesmas Malang Kota",
    organizationType: "FASKES",
    faskesClass: "FKTP",
    faskesCode: "DEMO-FKTP-JTM02",
    category: "FASKES",
    serviceArea: "Kecamatan Klojen",
    addressLabel: "Puskesmas Malang Kota",
    latitude: -7.9786,
    longitude: 112.6304,
  },
];

export const DEMO_THEMES: readonly DemoTheme[] = [
  {
    n: 1,
    slug: "edukasi-jkn",
    name: "Edukasi JKN",
    description: "Pemahaman hak, alur, dan manfaat layanan JKN bagi peserta.",
  },
  {
    n: 2,
    slug: "layanan-primer",
    name: "Layanan Primer",
    description: "Penguatan faskes primer, antrean, dan mutu layanan dasar.",
  },
  {
    n: 3,
    slug: "kesehatan-ibu-anak",
    name: "Kesehatan Ibu & Anak",
    description: "Kehamilan, persalinan, tumbuh kembang, dan gizi anak.",
  },
  {
    n: 4,
    slug: "pencegahan-penyakit",
    name: "Pencegahan Penyakit",
    description: "Skrining, imunisasi, dan kampanye hidup sehat.",
  },
  {
    n: 5,
    slug: "transformasi-digital",
    name: "Transformasi Digital",
    description: "Layanan digital, data, dan transparansi informasi.",
  },
];

const REGIONAL_NAMES = ["Ayu Larasati", "Bima Prasetyo", "Citra Mahardika"];
const BRANCH_NAMES = [
  "Damar Wijaya",
  "Eka Nuraini",
  "Fajar Ramadhan",
  "Gita Puspita",
  "Hadi Santoso",
  "Indah Permata",
  "Joko Susilo",
  "Kartika Sari",
];
const STAKEHOLDER_NAMES = [
  "Nadia Prameswari",
  "Bagas Aryasatya",
  "Sekar Wulandari",
  "Rina Kartika",
  "Yoga Pratama",
  "Lestari Handayani",
  "Dimas Saputra",
  "Putri Anggraini",
  "Arif Setiawan",
  "Maya Kusuma",
  "Bayu Nugroho",
  "Sinta Maharani",
  "Rizal Firmansyah",
  "Dewi Lestari",
  "Agus Wibowo",
  "Nur Aisyah",
  "Eko Purnomo",
  "Ratna Sari",
  "Hendra Gunawan",
  "Wulan Salsabila",
];
const BRANCH_EMAIL_CODES = ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2"];

function buildAccounts(): DemoAccount[] {
  const accounts: DemoAccount[] = [
    {
      n: 1,
      email: `admin@${DEMO_DOMAIN}`,
      name: "Ratu Sevilla Hizriyah",
      title: "Master Admin DAKOSTA (Demo)",
      role: "MASTER_ADMIN",
      regionN: null,
      branchN: null,
      organizationN: null,
    },
  ];

  DEMO_REGIONS.forEach((region) => {
    accounts.push({
      n: 1 + region.n,
      email: `wilayah.${String.fromCharCode(96 + region.n)}@${DEMO_DOMAIN}`,
      name: REGIONAL_NAMES[region.n - 1]!,
      title: `Admin ${region.name}`,
      role: "REGIONAL_ADMIN",
      regionN: region.n,
      branchN: null,
      organizationN: null,
    });
  });

  DEMO_BRANCHES.forEach((branch) => {
    accounts.push({
      n: 4 + branch.n,
      email: `cabang.${BRANCH_EMAIL_CODES[branch.n - 1]}@${DEMO_DOMAIN}`,
      name: BRANCH_NAMES[branch.n - 1]!,
      title: `Admin ${branch.name}`,
      role: "BRANCH_ADMIN",
      regionN: null,
      branchN: branch.n,
      organizationN: null,
    });
  });

  DEMO_ORGANIZATIONS.forEach((organization) => {
    accounts.push({
      n: 12 + organization.n,
      email: `mitra.${String(organization.n).padStart(2, "0")}@${DEMO_DOMAIN}`,
      name: STAKEHOLDER_NAMES[organization.n - 1]!,
      title: `Koordinator Konten ${organization.name}`,
      role: "STAKEHOLDER",
      regionN: null,
      branchN: null,
      organizationN: organization.n,
    });
  });

  return accounts;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = buildAccounts();

export function accountForOrganization(organizationN: number): DemoAccount {
  return DEMO_ACCOUNTS[12 + organizationN - 1]!;
}

export function accountForBranch(branchN: number): DemoAccount {
  return DEMO_ACCOUNTS[4 + branchN - 1]!;
}

export function branchForOrganization(organizationN: number): number {
  return DEMO_ORGANIZATIONS[organizationN - 1]!.branchN;
}

export function regionForOrganization(organizationN: number): number {
  return DEMO_BRANCHES[branchForOrganization(organizationN) - 1]!.regionN;
}

export function organizationForContent(
  n: number,
  volume: DemoVolume = DEMO_VOLUME,
): number {
  const perPeriod = demoSubmissionsPerMonth(volume);
  return Math.floor(((n - 1) % perPeriod) / volume.slotsPerOrgMonth) + 1;
}

function mix32(a: number, b: number, c: number): number {
  let hash = (a * 0x9e3779b1) ^ (b * 0x85ebca6b) ^ (c * 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function demoStatusFor(
  age: number,
  organizationN: number,
  slot: number,
): DemoStatus {
  if (age === 0) {
    return (
      ["APPROVED", "APPROVED", "SUBMITTED", "SUBMITTED", "DRAFT"] as const
    )[slot]!;
  }
  if (age === 1) {
    return (
      [
        "APPROVED",
        "APPROVED",
        "SUBMITTED",
        "REVISION_REQUIRED",
        "APPROVED",
      ] as const
    )[slot]!;
  }
  if (age === 2) {
    return (
      [
        "APPROVED",
        "APPROVED",
        "APPROVED",
        "REVISION_REQUIRED",
        "REVISION_REQUIRED",
      ] as const
    )[slot]!;
  }
  if (slot === 0 || slot === 1 || slot === 2) return "APPROVED";
  if (slot === 3) {
    return mix32(organizationN, age, 1) % 4 === 0
      ? "REVISION_REQUIRED"
      : "APPROVED";
  }
  return age % 3 === 0 ? "REVISION_REQUIRED" : "APPROVED";
}

const PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "X",
  "TIKTOK",
  "YOUTUBE",
  "WEBSITE",
  "LAINNYA",
] as const;

const TITLE_POOL: Record<SubTheme, readonly string[]> = {
  MOBILE_JKN: [
    "Panduan Mobile JKN untuk peserta baru",
    "Cek kepesertaan lewat Mobile JKN",
    "Fitur antrean daring di Mobile JKN",
  ],
  TESTIMONI_PESERTA: [
    "Testimoni peserta setelah berobat di faskes",
    "Cerita peserta memakai layanan primer",
    "Pengalaman peserta mengurus rujukan",
  ],
  ALUR_BEROBAT: [
    "Alur berobat berjenjang yang mudah dipahami",
    "Langkah rujukan dari faskes primer",
    "Panduan datang berobat ke fasilitas kesehatan",
  ],
  EDUKATIF_PERSUASIF: [
    "Kebiasaan sehat yang bisa dimulai hari ini",
    "Mengapa skrining rutin itu penting",
    "Edukasi gizi seimbang untuk keluarga",
  ],
  KORPORAT: [
    "Kolaborasi layanan kesehatan bersama mitra",
    "Transparansi layanan untuk peserta",
    "Program kesehatan lingkungan kerja",
  ],
  INFORMASI: [
    "Informasi jam layanan dan kontak faskes",
    "Kanal pengaduan layanan yang mudah",
    "Ringkasan manfaat layanan kesehatan",
  ],
};

const SUB_THEME_NARRATIVE: Record<SubTheme, string> = {
  MOBILE_JKN:
    "Mengenalkan fitur aplikasi layanan peserta, cara memeriksa kepesertaan, serta pengingat jadwal berobat.",
  TESTIMONI_PESERTA:
    "Merangkum pengalaman peserta sintetis saat memakai layanan primer tanpa memuat identitas pribadi.",
  ALUR_BEROBAT:
    "Menjelaskan tahapan berobat, rujukan berjenjang, dan dokumen yang perlu disiapkan peserta.",
  EDUKATIF_PERSUASIF:
    "Mengajak masyarakat menjaga kesehatan dengan langkah sederhana yang didukung tenaga kesehatan.",
  KORPORAT:
    "Memaparkan komitmen organisasi terhadap mutu layanan dan kolaborasi lintas lembaga kesehatan.",
  INFORMASI:
    "Menyampaikan informasi layanan, jadwal, dan kanal komunikasi resmi bagi masyarakat sekitar.",
};

const JITTER: ReadonlyArray<readonly [number, number]> = [
  [0.0012, 0.0008],
  [-0.0009, 0.0014],
  [0.0016, -0.0011],
  [-0.0005, -0.0018],
  [0.0007, 0.0011],
  [-0.0013, 0.0004],
];

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function jakartaDateOnly(instant: Date): string {
  return jakartaDateFormatter.format(instant);
}

function clampInstant(candidate: Date, now: Date): Date {
  return candidate.getTime() > now.getTime()
    ? new Date(now.getTime())
    : candidate;
}

function instant(dateOnly: string, hourUtc: number, minute = 0): Date {
  const [year, month, day] = dateOnly.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day, hourUtc, minute, 0, 0));
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function monthEnd(period: string): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(lastDay).padStart(2, "0")}`;
}

function policyNForAge(age: number): number {
  return age + 1;
}

function decisionReason(status: DemoStatus): string | null {
  switch (status) {
    case "APPROVED":
      return "Konten sesuai tema, tautan aktif, dan lokasi terverifikasi.";
    case "REVISION_REQUIRED":
      return "Mohon lengkapi tautan publikasi dan perjelas sumber data pendukung.";
    default:
      return null;
  }
}

function buildPolicies(
  now: Date,
  volume: DemoVolume = DEMO_VOLUME,
): {
  policies: DemoPolicy[];
  events: DemoPolicyEvent[];
} {
  const current = periodOf(now);
  const definitions = Array.from({ length: volume.months }, (_, age) => ({
    n: age + 1,
    period: shiftPeriod(current, -age),
  }));

  const policies = definitions.map((item) => {
    const publishedAt = clampInstant(instant(`${item.period}-01`, 1, 0), now);
    const createdAt = new Date(Math.max(publishedAt.getTime() - 3_600_000, 0));
    const explanation =
      item.n === 1
        ? "Fokus EDUFAST bulan berjalan: pemanfaatan Mobile JKN, alur berobat, testimoni peserta, dan edukasi persuasif."
        : `Fokus EDUFAST periode ${item.period}: informasi layanan, alur berobat, dan konten korporat.`;
    return {
      n: item.n,
      id: DEMO_IDS.policy(item.n),
      period: item.period,
      periodStart: `${item.period}-01`,
      periodEnd: monthEnd(item.period),
      explanation,
      createdAt,
      publishedAt,
    };
  });

  const events: DemoPolicyEvent[] = [];
  let eventN = 1;
  for (const policy of policies) {
    events.push({
      n: eventN,
      id: DEMO_IDS.policyEvent(eventN),
      policyN: policy.n,
      action: "CREATED",
      snapshot: { period: policy.period, version: 1 },
      createdAt: policy.createdAt,
    });
    eventN += 1;
    events.push({
      n: eventN,
      id: DEMO_IDS.policyEvent(eventN),
      policyN: policy.n,
      action: "PUBLISHED",
      snapshot: {
        period: policy.period,
        version: 1,
        subThemes: SUB_THEMES.length,
      },
      createdAt: policy.publishedAt,
    });
    eventN += 1;
  }

  return { policies, events };
}

function periodOf(now: Date): string {
  return jakartaDateOnly(now).slice(0, 7);
}

export function buildSubmissions(
  now: Date = new Date(),
  volume: DemoVolume = DEMO_VOLUME,
): DemoSubmission[] {
  const today = jakartaDateOnly(now);
  const current = periodOf(now);
  const elapsedDay = Number(today.slice(8, 10));
  const submissions: DemoSubmission[] = [];
  let n = 1;

  for (let age = 0; age < volume.months; age += 1) {
    const period = shiftPeriod(current, -age);
    for (
      let organizationN = 1;
      organizationN <= DEMO_ORGANIZATIONS.length;
      organizationN += 1
    ) {
      const organization = DEMO_ORGANIZATIONS[organizationN - 1]!;
      const branchN = organization.branchN;
      const regionN = DEMO_BRANCHES[branchN - 1]!.regionN;
      const authorAccountN = 12 + organizationN;
      const reviewerAccountN = 4 + branchN;

      for (let slot = 0; slot < volume.slotsPerOrgMonth; slot += 1) {
        const seqInPeriod =
          (organizationN - 1) * volume.slotsPerOrgMonth + slot + 1;
        const seed = mix32(organizationN, age, slot);
        const status = demoStatusFor(age, organizationN, slot);
        const day =
          age === 0
            ? 1 + (seed % Math.max(1, elapsedDay - 1))
            : 1 + (seed % 26);
        const dateCreated = `${period}-${String(day).padStart(2, "0")}`;
        const subTheme =
          SUB_THEMES[(organizationN - 1 + slot) % SUB_THEMES.length]!;
        const titlePool = TITLE_POOL[subTheme];
        const title = `${titlePool[(organizationN + slot) % titlePool.length]} · ${organization.name}`;
        const publishedUrl = `https://demo.dakosta.example/konten/${String(n).padStart(4, "0")}`;
        const normalized = normalizePublishedUrl(publishedUrl);
        const isDraft = status === "DRAFT";
        const isResubmitted = status === "SUBMITTED" && slot === 2;
        const isEdufast = slot % 2 === 0;

        const createdAt = clampInstant(
          instant(dateCreated, 2, 20 + (seed % 40)),
          now,
        );
        const initialSubmitAt = clampInstant(
          instant(dateCreated, 3, seed % 60),
          now,
        );

        let submittedAt: Date | null = isDraft ? null : initialSubmitAt;
        let approvedAt: Date | null = null;
        const revokedAt: Date | null = null;
        let updatedAt = isDraft ? createdAt : initialSubmitAt;

        if (status === "APPROVED") {
          approvedAt = clampInstant(addDays(initialSubmitAt, 1), now);
          updatedAt = approvedAt;
        } else if (status === "REVISION_REQUIRED") {
          updatedAt = clampInstant(addDays(initialSubmitAt, 0.5), now);
        } else if (isResubmitted) {
          const revisionAt = clampInstant(addDays(initialSubmitAt, 0.5), now);
          submittedAt = clampInstant(addDays(revisionAt, 0.5), now);
          updatedAt = submittedAt;
        }

        const approvedSnapshot =
          approvedAt !== null
            ? {
                title,
                mainTheme: isEdufast ? "EDUFAST" : "NON_EDUFAST",
                subTheme,
                version: 1,
              }
            : null;

        submissions.push({
          n,
          id: DEMO_IDS.submission(n),
          referenceCode: `DKS-${period.replace("-", "")}-D${String(seqInPeriod).padStart(4, "0")}`,
          organizationN,
          regionN,
          branchN,
          authorAccountN,
          reviewerAccountN:
            status === "DRAFT" || (status === "SUBMITTED" && !isResubmitted)
              ? null
              : reviewerAccountN,
          title,
          narrative: `${title}. ${SUB_THEME_NARRATIVE[subTheme]} Narasi ini merupakan konten demonstrasi sintetis dan tidak memuat data pribadi, nomor identitas, maupun rekam medis.`,
          publishedUrl,
          normalizedUrl: normalized.normalizedUrl,
          normalizedUrlHash: normalized.normalizedUrlHash,
          platform: PLATFORMS[(organizationN + slot + age) % PLATFORMS.length]!,
          contentType: isEdufast ? "VIDEO" : "INFOGRAFIS",
          mainTheme: isEdufast ? "EDUFAST" : "NON_EDUFAST",
          subTheme,
          themeSlug:
            DEMO_THEMES[(organizationN + slot + age) % DEMO_THEMES.length]!
              .slug,
          period,
          dateCreated,
          publishedAt: isDraft ? null : dateCreated,
          status,
          version: isResubmitted ? 2 : 1,
          resubmissionCount: isResubmitted ? 1 : 0,
          submittedAt,
          approvedAt,
          revokedAt,
          createdAt,
          updatedAt,
          decisionReason: decisionReason(status),
          archived: false,
          approvedSnapshot,
          approvedVersion: approvedAt !== null ? 1 : null,
          edufastPolicyN: isEdufast ? policyNForAge(age) : null,
          edufastPolicyVersion: isEdufast ? 1 : null,
          idempotencyKey: `${DEMO_SEED_VERSION}:submission:${String(n).padStart(5, "0")}`,
        });
        n += 1;
      }
    }
  }

  return submissions;
}

export function buildLocations(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
): DemoLocation[] {
  return submissions.map((submission) => {
    const organization = DEMO_ORGANIZATIONS[submission.organizationN - 1]!;
    const seed = mix32(submission.organizationN, submission.n, 2);
    const jitter = JITTER[submission.n % JITTER.length]!;
    const isGps = seed % 3 !== 0;
    const createdAt = clampInstant(
      instant(submission.dateCreated, 2, seed % 60),
      now,
    );

    return {
      n: submission.n,
      id: DEMO_IDS.location(submission.n),
      submissionN: submission.n,
      latitude: Number((organization.latitude + jitter[0]).toFixed(6)),
      longitude: Number((organization.longitude + jitter[1]).toFixed(6)),
      label: `${organization.name} — titik konten demo`,
      source: isGps ? "device_gps" : "manual_pin",
      accuracyMeters: isGps ? 25 : null,
      consentAt: isGps ? createdAt : null,
      verifiedStatus: isGps ? "VERIFIED" : "MANUAL_UNVERIFIED",
      precision: isGps ? "exact" : "approximate",
      createdAt,
    };
  });
}

export function buildRevisions(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
): DemoRevision[] {
  const revisions: DemoRevision[] = [];
  let revisionN = 1;

  for (const submission of submissions) {
    if (submission.status === "DRAFT" || submission.submittedAt === null)
      continue;
    const baseSnapshot = {
      title: submission.title,
      narrative: submission.narrative,
      status: "SUBMITTED",
      version: 1,
    };
    revisions.push({
      n: revisionN,
      id: DEMO_IDS.revision(revisionN),
      submissionN: submission.n,
      version: 1,
      snapshot: baseSnapshot,
      actorAccountN: submission.authorAccountN,
      reason: null,
      createdAt: submission.submittedAt,
    });
    revisionN += 1;

    if (submission.status === "SUBMITTED" && submission.version > 1) {
      revisions.push({
        n: revisionN,
        id: DEMO_IDS.revision(revisionN),
        submissionN: submission.n,
        version: 2,
        snapshot: {
          ...baseSnapshot,
          status: "SUBMITTED",
          version: 2,
        },
        actorAccountN: submission.authorAccountN,
        reason: "Perbaikan sesuai catatan reviewer.",
        createdAt: submission.updatedAt,
      });
      revisionN += 1;
    }
  }

  return revisions;
}

export function buildReviews(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
): DemoReview[] {
  const reviews: DemoReview[] = [];
  let reviewN = 1;

  const push = (review: Omit<DemoReview, "n" | "id">) => {
    reviews.push({ ...review, n: reviewN, id: DEMO_IDS.review(reviewN) });
    reviewN += 1;
  };

  for (const submission of submissions) {
    const reviewerAccountN = submission.reviewerAccountN;
    if (reviewerAccountN === null || submission.submittedAt === null) continue;

    if (submission.status === "APPROVED") {
      push({
        submissionN: submission.n,
        version: 1,
        reviewerAccountN,
        action: "APPROVE",
        checklist: {
          relevansiTema: true,
          akurasiKonten: true,
          kelengkapanTautan: true,
          etikaDanPrivasi: true,
        },
        notes: submission.decisionReason,
        previousStatus: "SUBMITTED",
        nextStatus: "APPROVED",
        reviewerRole: "BRANCH_ADMIN",
        createdAt: submission.approvedAt ?? submission.updatedAt,
      });
    } else if (submission.status === "REVISION_REQUIRED") {
      push({
        submissionN: submission.n,
        version: 1,
        reviewerAccountN,
        action: "REQUEST_REVISION",
        checklist: {
          relevansiTema: true,
          akurasiKonten: false,
          kelengkapanTautan: false,
          etikaDanPrivasi: true,
        },
        notes: submission.decisionReason,
        previousStatus: "SUBMITTED",
        nextStatus: "REVISION_REQUIRED",
        reviewerRole: "BRANCH_ADMIN",
        createdAt: submission.updatedAt,
      });
    } else if (submission.status === "SUBMITTED" && submission.version > 1) {
      push({
        submissionN: submission.n,
        version: 1,
        reviewerAccountN,
        action: "REQUEST_REVISION",
        checklist: {
          relevansiTema: true,
          akurasiKonten: false,
          kelengkapanTautan: false,
          etikaDanPrivasi: true,
        },
        notes: "Perbaiki tautan publikasi sebelum dikirim ulang.",
        previousStatus: "SUBMITTED",
        nextStatus: "REVISION_REQUIRED",
        reviewerRole: "BRANCH_ADMIN",
        createdAt: clampInstant(addDays(submission.updatedAt, -0.5), now),
      });
    }
  }

  return reviews;
}

function approvedCountsByOrganizationPeriod(
  submissions: readonly DemoSubmission[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const submission of submissions) {
    if (submission.status !== "APPROVED" || submission.approvedAt === null) {
      continue;
    }
    const period = jakartaDateOnly(submission.approvedAt).slice(0, 7);
    const key = `${submission.organizationN}:${period}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function targetDelta(age: number, organizationN: number): number {
  if (age === 0) return 1;
  return ([-1, 0, 1] as const)[(organizationN + age) % 3]!;
}

export function buildTargets(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
  volume: DemoVolume = DEMO_VOLUME,
): DemoTarget[] {
  const current = periodOf(now);
  const approved = approvedCountsByOrganizationPeriod(submissions);
  const targets: DemoTarget[] = [];
  let targetN = 1;

  const push = (
    target: Omit<
      DemoTarget,
      "n" | "id" | "periodStart" | "periodEnd" | "createdAt"
    >,
  ) => {
    targets.push({
      ...target,
      n: targetN,
      id: DEMO_IDS.target(targetN),
      periodStart: `${target.period}-01`,
      periodEnd: monthEnd(target.period),
      createdAt: clampInstant(instant(`${target.period}-01`, 1, 30), now),
    });
    targetN += 1;
  };

  for (let age = 0; age < volume.months; age += 1) {
    const period = shiftPeriod(current, -age);
    const organizationTargets = DEMO_ORGANIZATIONS.map((organization) => {
      const approvedCount = approved.get(`${organization.n}:${period}`) ?? 0;
      return Math.max(1, approvedCount + targetDelta(age, organization.n));
    });
    const globalTarget = organizationTargets.reduce(
      (sum, target) => sum + target,
      0,
    );
    const subThemeBase = Math.floor(globalTarget / SUB_THEMES.length);
    const subThemeRemainder = globalTarget % SUB_THEMES.length;

    push({
      workspaceLabel: "Workspace DAKOSTA",
      organizationN: null,
      subTheme: null,
      period,
      targetCount: globalTarget,
    });

    SUB_THEMES.forEach((subTheme, index) => {
      push({
        workspaceLabel: `Sub-tema ${subTheme}`,
        organizationN: null,
        subTheme,
        period,
        targetCount: subThemeBase + (index === 0 ? subThemeRemainder : 0),
      });
    });

    DEMO_ORGANIZATIONS.forEach((organization, index) => {
      push({
        workspaceLabel: organization.name,
        organizationN: organization.n,
        subTheme: null,
        period,
        targetCount: organizationTargets[index]!,
      });
    });
  }

  return targets;
}

function decisionNotification(
  review: DemoReview,
  submission: DemoSubmission,
): { eventType: string; title: string; body: string } {
  switch (review.action) {
    case "APPROVE":
      return {
        eventType: "SUBMISSION_APPROVED",
        title: "Konten disetujui",
        body: `${submission.referenceCode} telah disetujui admin cabang dan dihitung dalam capaian.`,
      };
    case "REJECT":
    case "REQUEST_REVISION":
      return {
        eventType: "REVISION_REQUIRED",
        title: "Konten perlu revisi",
        body: `${submission.referenceCode} memerlukan perbaikan sebelum dapat disetujui.`,
      };
    default:
      throw new Error(`Aksi ulasan tidak dikenal: ${String(review.action)}`);
  }
}

export function buildNotifications(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
  reviews = buildReviews(now, submissions),
): DemoNotification[] {
  const notifications: DemoNotification[] = [];
  let notificationN = 1;

  const push = (notification: Omit<DemoNotification, "n" | "id">) => {
    notifications.push({
      ...notification,
      n: notificationN,
      id: DEMO_IDS.notification(notificationN),
    });
    notificationN += 1;
  };

  for (const submission of submissions) {
    if (submission.status !== "SUBMITTED") {
      continue;
    }
    const organization = DEMO_ORGANIZATIONS[submission.organizationN - 1]!;
    push({
      recipientAccountN:
        submission.reviewerAccountN ?? accountForBranch(submission.branchN).n,
      eventType: "CONTENT_SUBMITTED",
      title: "Konten baru menunggu review",
      body: `${organization.name} mengirim ${submission.referenceCode} untuk ditinjau.`,
      objectType: "CONTENT_SUBMISSION",
      objectId: submission.id,
      href: `/cabang/review/${submission.id}`,
      branchN: submission.branchN,
      organizationN: submission.organizationN,
      readAt: null,
      dedupeKey: `demo:notif:submission:${String(submission.n).padStart(4, "0")}`,
      createdAt: submission.submittedAt ?? submission.createdAt,
    });
  }

  for (const review of reviews) {
    const submission = submissions[review.submissionN - 1]!;
    const decision = decisionNotification(review, submission);
    push({
      recipientAccountN: submission.authorAccountN,
      eventType: decision.eventType,
      title: decision.title,
      body: decision.body,
      objectType: "CONTENT_SUBMISSION",
      objectId: submission.id,
      href: `/client/konten/${submission.id}`,
      branchN: submission.branchN,
      organizationN: submission.organizationN,
      readAt:
        review.createdAt.getTime() < now.getTime() - 7 * DAY_MS
          ? new Date(review.createdAt.getTime() + 3_600_000)
          : null,
      dedupeKey: `demo:notif:review:${String(review.n).padStart(4, "0")}`,
      createdAt: review.createdAt,
    });
  }

  for (const region of DEMO_REGIONS) {
    const branch = DEMO_BRANCHES.find((item) => item.regionN === region.n)!;
    push({
      recipientAccountN: 1 + region.n,
      eventType: "SLA_REMINDER",
      title: "Antrean review mendekati SLA",
      body: `${branch.name} memiliki konten yang menunggu lebih dari lima hari.`,
      objectType: "BRANCH",
      objectId: DEMO_IDS.branch(branch.n),
      href: "/wilayah/cabang",
      branchN: branch.n,
      organizationN: null,
      readAt: null,
      dedupeKey: `demo:notif:sla:${region.n}`,
      createdAt: clampInstant(new Date(now.getTime() - DAY_MS), now),
    });
  }

  push({
    recipientAccountN: 1,
    eventType: "DIGEST_QUEUE",
    title: "Ringkasan antrean review",
    body: "Ada konten baru dari beberapa cabang yang menunggu keputusan reviewer.",
    objectType: "WORKSPACE",
    objectId: "demo-digest-queue",
    href: "/admin",
    branchN: null,
    organizationN: null,
    readAt: null,
    dedupeKey: "demo:notif:digest:queue",
    createdAt: clampInstant(new Date(now.getTime() - 2 * 3_600_000), now),
  });

  push({
    recipientAccountN: 1,
    eventType: "DIGEST_PERIOD",
    title: "Ringkasan capaian periode",
    body: "Capaian konten disetujui pada periode berjalan sudah diperbarui.",
    objectType: "WORKSPACE",
    objectId: "demo-digest-period",
    href: "/admin",
    branchN: null,
    organizationN: null,
    readAt: null,
    dedupeKey: "demo:notif:digest:period",
    createdAt: clampInstant(new Date(now.getTime() - 3_600_000), now),
  });

  return notifications;
}

export function buildOutbox(
  now: Date = new Date(),
  notifications = buildNotifications(now),
): DemoOutbox[] {
  return notifications.map((notification) => ({
    n: notification.n,
    id: DEMO_IDS.outbox(notification.n),
    notificationN: notification.n,
    eventKey: notification.dedupeKey,
    aggregateType: notification.objectType,
    aggregateId: notification.objectId,
    eventType: notification.eventType,
    payload: {
      notificationId: notification.id,
      recipientId: DEMO_IDS.user(notification.recipientAccountN),
      title: notification.title,
    },
    recipientAccountN: notification.recipientAccountN,
    processedAt: clampInstant(
      new Date(notification.createdAt.getTime() + 60_000),
      now,
    ),
    createdAt: notification.createdAt,
  }));
}

const AUDIT_ACTION: Record<DemoReviewAction, string> = {
  APPROVE: "CONTENT_APPROVED",
  REJECT: "CONTENT_REJECTED",
  REQUEST_REVISION: "CONTENT_REVISION_REQUESTED",
  REVOKE: "CONTENT_REVOKED",
};

export function buildAudits(
  now: Date = new Date(),
  submissions = buildSubmissions(now),
  reviews = buildReviews(now, submissions),
  policies = buildPolicies(now).policies,
): DemoAudit[] {
  const audits: DemoAudit[] = [];
  let auditN = 1;

  audits.push({
    n: auditN,
    id: DEMO_IDS.audit(auditN),
    actorAccountN: 1,
    actorRole: "MASTER_ADMIN",
    action: "SEED_DEMO_FIXTURES",
    recordType: "WORKSPACE",
    recordId: "production-demo-v1",
    regionN: null,
    branchN: null,
    organizationN: null,
    after: {
      accounts: DEMO_ACCOUNTS.length,
      regions: DEMO_REGIONS.length,
      branches: DEMO_BRANCHES.length,
      organizations: DEMO_ORGANIZATIONS.length,
      submissions: submissions.length,
    },
    source: "SEED",
    createdAt: clampInstant(new Date(now.getTime() - 60_000), now),
  });
  auditN += 1;

  audits.push({
    n: auditN,
    id: DEMO_IDS.audit(auditN),
    actorAccountN: 1,
    actorRole: "MASTER_ADMIN",
    action: "HIERARCHY_SEEDED",
    recordType: "WORKSPACE",
    recordId: "production-demo-hierarchy",
    regionN: null,
    branchN: null,
    organizationN: null,
    after: {
      regions: DEMO_REGIONS.length,
      branches: DEMO_BRANCHES.length,
      organizations: DEMO_ORGANIZATIONS.length,
    },
    source: "SEED",
    createdAt: clampInstant(new Date(now.getTime() - 120_000), now),
  });
  auditN += 1;

  for (const review of reviews) {
    const submission = submissions[review.submissionN - 1]!;
    audits.push({
      n: auditN,
      id: DEMO_IDS.audit(auditN),
      actorAccountN: review.reviewerAccountN,
      actorRole: "BRANCH_ADMIN",
      action: AUDIT_ACTION[review.action],
      recordType: "CONTENT_SUBMISSION",
      recordId: submission.id,
      regionN: submission.regionN,
      branchN: submission.branchN,
      organizationN: submission.organizationN,
      after: { status: review.nextStatus },
      source: "SEED",
      createdAt: review.createdAt,
    });
    auditN += 1;
  }

  const currentPolicy = policies[0]!;
  audits.push({
    n: auditN,
    id: DEMO_IDS.audit(auditN),
    actorAccountN: 1,
    actorRole: "MASTER_ADMIN",
    action: "EDUFAST_POLICY_PUBLISHED",
    recordType: "EDUFAST_POLICY",
    recordId: currentPolicy.id,
    regionN: null,
    branchN: null,
    organizationN: null,
    after: {
      period: currentPolicy.period,
      version: 1,
      subThemes: SUB_THEMES.length,
    },
    source: "SEED",
    createdAt: currentPolicy.publishedAt,
  });

  return audits;
}

export type DemoDataset = {
  now: Date;
  currentPeriod: string;
  previousPeriod: string;
  periods: string[];
  accounts: DemoAccount[];
  regions: readonly DemoRegion[];
  branches: readonly DemoBranch[];
  organizations: readonly DemoOrganization[];
  themes: readonly DemoTheme[];
  policies: DemoPolicy[];
  policyEvents: DemoPolicyEvent[];
  locations: DemoLocation[];
  submissions: DemoSubmission[];
  revisions: DemoRevision[];
  reviews: DemoReview[];
  targets: DemoTarget[];
  notifications: DemoNotification[];
  outbox: DemoOutbox[];
  audits: DemoAudit[];
};

export function buildDemoDataset(
  now: Date = new Date(),
  volume: DemoVolume = DEMO_VOLUME,
): DemoDataset {
  const currentPeriod = periodOf(now);
  const previousPeriod = shiftPeriod(currentPeriod, -1);
  const periods = Array.from({ length: volume.months }, (_, age) =>
    shiftPeriod(currentPeriod, -age),
  );
  const policies = buildPolicies(now, volume);
  const submissions = buildSubmissions(now, volume);
  const revisions = buildRevisions(now, submissions);
  const reviews = buildReviews(now, submissions);
  const notifications = buildNotifications(now, submissions, reviews);

  return {
    now,
    currentPeriod,
    previousPeriod,
    periods,
    accounts: [...DEMO_ACCOUNTS],
    regions: DEMO_REGIONS,
    branches: DEMO_BRANCHES,
    organizations: DEMO_ORGANIZATIONS,
    themes: DEMO_THEMES,
    policies: policies.policies,
    policyEvents: policies.events,
    locations: buildLocations(now, submissions),
    submissions,
    revisions,
    reviews,
    targets: buildTargets(now, submissions, volume),
    notifications,
    outbox: buildOutbox(now, notifications),
    audits: buildAudits(now, submissions, reviews, policies.policies),
  };
}

function countByStatus(
  submissions: DemoSubmission[],
): Record<DemoStatus, number> {
  const base: Record<DemoStatus, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    REVISION_REQUIRED: 0,
    APPROVED: 0,
  };
  for (const submission of submissions) base[submission.status] += 1;
  return base;
}

export function expectedCounts(
  now: Date = new Date(),
  volume: DemoVolume = DEMO_VOLUME,
) {
  const dataset = buildDemoDataset(now, volume);
  const status = countByStatus(dataset.submissions);
  const approvedInPeriod = (period: string): number =>
    dataset.submissions.filter(
      (submission) =>
        submission.status === "APPROVED" &&
        submission.approvedAt !== null &&
        jakartaDateOnly(submission.approvedAt).slice(0, 7) === period,
    ).length;
  const globalTargetFor = (period: string): number => {
    const row = dataset.targets.find(
      (target) =>
        target.period === period &&
        target.organizationN === null &&
        target.subTheme === null,
    );
    if (!row) {
      throw new Error(`Target global ${period} tidak ditemukan`);
    }
    return row.targetCount;
  };
  const branchPending = DEMO_BRANCHES.map(
    (branch) =>
      dataset.submissions.filter(
        (submission) =>
          submission.branchN === branch.n && submission.status === "SUBMITTED",
      ).length,
  );
  const branchApproved = DEMO_BRANCHES.map(
    (branch) =>
      dataset.submissions.filter(
        (submission) =>
          submission.branchN === branch.n && submission.status === "APPROVED",
      ).length,
  );
  const regionSubmissions = DEMO_REGIONS.map(
    (region) =>
      dataset.submissions.filter(
        (submission) => submission.regionN === region.n,
      ).length,
  );
  const approvedCurrent = approvedInPeriod(dataset.currentPeriod);
  const approvedPrevious = approvedInPeriod(dataset.previousPeriod);
  const oldestPeriod = dataset.periods[dataset.periods.length - 1]!;
  const approvedOldest = approvedInPeriod(oldestPeriod);
  const edufast = dataset.submissions.filter(
    (submission) => submission.mainTheme === "EDUFAST",
  );
  const nonDraft = dataset.submissions.filter(
    (submission) => submission.status !== "DRAFT",
  ).length;
  const mapPoints = dataset.submissions.filter(
    (submission) => submission.status !== "DRAFT" && !submission.archived,
  ).length;

  return {
    currentPeriod: dataset.currentPeriod,
    previousPeriod: dataset.previousPeriod,
    periods: dataset.periods,
    volume,
    oldestPeriod,
    regions: dataset.regions.length,
    branches: dataset.branches.length,
    organizations: dataset.organizations.length,
    faskes: dataset.organizations.filter(
      (item) => item.organizationType === "FASKES",
    ).length,
    pemda: dataset.organizations.filter(
      (item) => item.organizationType === "PEMDA",
    ).length,
    other: dataset.organizations.filter(
      (item) => item.organizationType === "OTHER",
    ).length,
    accounts: dataset.accounts.length,
    masterAccounts: dataset.accounts.filter(
      (item) => item.role === "MASTER_ADMIN",
    ).length,
    regionalAccounts: dataset.accounts.filter(
      (item) => item.role === "REGIONAL_ADMIN",
    ).length,
    branchAccounts: dataset.accounts.filter(
      (item) => item.role === "BRANCH_ADMIN",
    ).length,
    stakeholderAccounts: dataset.accounts.filter(
      (item) => item.role === "STAKEHOLDER",
    ).length,
    policies: dataset.policies.length,
    policySubthemes: dataset.policies.length * SUB_THEMES.length,
    policyEvents: dataset.policyEvents.length,
    locations: dataset.locations.length,
    submissions: dataset.submissions.length,
    status,
    pending: status.SUBMITTED,
    approved: status.APPROVED,
    approvedCurrent,
    approvedPrevious,
    approvedOldest,
    nonDraft,
    mapPoints,
    edufast: edufast.length,
    edufastDistinctSubthemes: new Set(edufast.map((item) => item.subTheme))
      .size,
    video: dataset.submissions.filter((item) => item.contentType === "VIDEO")
      .length,
    infografis: dataset.submissions.filter(
      (item) => item.contentType === "INFOGRAFIS",
    ).length,
    revisions: dataset.revisions.length,
    reviews: dataset.reviews.length,
    targets: dataset.targets.length,
    notifications: dataset.notifications.length,
    outbox: dataset.outbox.length,
    audits: dataset.audits.length,
    branchPending,
    branchApproved,
    regionSubmissions,
    currentTarget: globalTargetFor(dataset.currentPeriod),
    previousTarget: globalTargetFor(dataset.previousPeriod),
    oldestTarget: globalTargetFor(oldestPeriod),
    currentApproved: approvedCurrent,
    previousApproved: approvedPrevious,
  };
}

export function assertFixtureIntegrity(
  now: Date = new Date(),
  volume: DemoVolume = DEMO_VOLUME,
): void {
  const dataset = buildDemoDataset(now, volume);
  const counts = expectedCounts(now, volume);
  const today = jakartaDateOnly(now);
  const perPeriod = demoSubmissionsPerMonth(volume);
  const targetsPerPeriod = 1 + SUB_THEMES.length + DEMO_ORGANIZATIONS.length;

  const fail = (message: string): never => {
    throw new Error(`Fixture demo tidak valid: ${message}`);
  };

  if (dataset.accounts.length !== 32)
    fail(`akun ${dataset.accounts.length}, harapan 32`);
  if (
    new Set(dataset.accounts.map((item) => item.email)).size !==
    dataset.accounts.length
  ) {
    fail("email akun duplikat");
  }
  if (
    counts.masterAccounts !== 1 ||
    counts.regionalAccounts !== 3 ||
    counts.branchAccounts !== 8 ||
    counts.stakeholderAccounts !== 20
  ) {
    fail("komposisi peran akun tidak sesuai");
  }
  for (const account of dataset.accounts) {
    if (!account.email.endsWith(`@${DEMO_DOMAIN}`))
      fail(`domain akun ${account.email}`);
    if (account.role === "REGIONAL_ADMIN" && account.regionN === null)
      fail("regional tanpa wilayah");
    if (account.role === "BRANCH_ADMIN" && account.branchN === null)
      fail("cabang tanpa cabang");
    if (account.role === "STAKEHOLDER" && account.organizationN === null)
      fail("stakeholder tanpa organisasi");
  }

  if (
    counts.regions !== 3 ||
    counts.branches !== 8 ||
    counts.organizations !== 20
  ) {
    fail("jumlah hierarki tidak sesuai");
  }
  if (counts.faskes !== 15 || counts.pemda !== 1 || counts.other !== 4) {
    fail("komposisi tipe organisasi tidak sesuai");
  }
  for (const organization of dataset.organizations) {
    if (organization.organizationType === "FASKES") {
      if (!/^DEMO-(FKTP|FKRTL)-/.test(organization.faskesCode ?? "")) {
        fail(`kode faskes ${organization.name}`);
      }
      if (!organization.faskesClass) fail(`kelas faskes ${organization.name}`);
    } else if (
      organization.faskesClass !== null ||
      organization.faskesCode !== null
    ) {
      fail(`organisasi non-faskes memiliki field faskes: ${organization.name}`);
    }
  }

  if (counts.submissions !== demoSubmissionTotal(volume)) {
    fail(
      `konten ${counts.submissions}, harapan ${demoSubmissionTotal(volume)}`,
    );
  }
  if (counts.policies !== volume.months) {
    fail(`kebijakan ${counts.policies}, harapan ${volume.months}`);
  }
  if (counts.policyEvents !== volume.months * 2) {
    fail(
      `event kebijakan ${counts.policyEvents}, harapan ${volume.months * 2}`,
    );
  }
  if (counts.policySubthemes !== volume.months * SUB_THEMES.length) {
    fail(`sub-tema kebijakan ${counts.policySubthemes} tidak sesuai`);
  }
  for (const [status, value] of Object.entries(counts.status)) {
    if (value <= 0) fail(`status ${status} tidak terwakili`);
  }
  if (counts.edufastDistinctSubthemes !== SUB_THEMES.length) {
    fail("EDUFAST harus mencakup semua sub-tema");
  }
  if (counts.video + counts.infografis !== counts.submissions) {
    fail("komposisi jenis konten tidak lengkap");
  }
  for (const branch of dataset.branches) {
    if (
      dataset.submissions.filter(
        (submission) => submission.branchN === branch.n,
      ).length === 0
    ) {
      fail(`cabang ${branch.code} tanpa konten`);
    }
  }
  for (const region of dataset.regions) {
    if (
      dataset.submissions.filter(
        (submission) => submission.regionN === region.n,
      ).length === 0
    ) {
      fail(`wilayah ${region.code} tanpa konten`);
    }
  }

  const submissionsByOrganizationPeriod = new Map<string, number>();
  const approvedByOrganizationPeriod = new Map<string, number>();
  for (const submission of dataset.submissions) {
    const orgKey = `${submission.organizationN}:${submission.period}`;
    submissionsByOrganizationPeriod.set(
      orgKey,
      (submissionsByOrganizationPeriod.get(orgKey) ?? 0) + 1,
    );
    if (submission.status !== "APPROVED" || submission.approvedAt === null) {
      continue;
    }
    const approvedPeriod = jakartaDateOnly(submission.approvedAt).slice(0, 7);
    if (approvedPeriod !== submission.period) {
      fail(
        `approvedAt konten ${submission.n} (${approvedPeriod}) di luar periode ${submission.period}`,
      );
    }
    const approvedKey = `${submission.organizationN}:${approvedPeriod}`;
    approvedByOrganizationPeriod.set(
      approvedKey,
      (approvedByOrganizationPeriod.get(approvedKey) ?? 0) + 1,
    );
  }

  for (const period of dataset.periods) {
    const inPeriod = dataset.submissions.filter(
      (submission) => submission.period === period,
    );
    if (inPeriod.length !== perPeriod) {
      fail(`konten periode ${period} ${inPeriod.length}, harapan ${perPeriod}`);
    }
    for (const organization of dataset.organizations) {
      const key = `${organization.n}:${period}`;
      if (
        (submissionsByOrganizationPeriod.get(key) ?? 0) !==
        volume.slotsPerOrgMonth
      ) {
        fail(`konten ${organization.name} periode ${period} tidak sesuai slot`);
      }
      if ((approvedByOrganizationPeriod.get(key) ?? 0) < 2) {
        fail(`approved ${organization.name} periode ${period} kurang dari 2`);
      }
    }
    const edufastCovered = new Set(
      inPeriod
        .filter((submission) => submission.mainTheme === "EDUFAST")
        .map((submission) => submission.subTheme),
    );
    if (edufastCovered.size !== SUB_THEMES.length) {
      fail(`EDUFAST ${period} tidak mencakup semua sub-tema`);
    }
  }

  if (counts.targets !== demoTargetTotal(volume)) {
    fail(`target ${counts.targets}, harapan ${demoTargetTotal(volume)}`);
  }
  const targetsByPeriod = new Map<string, DemoTarget[]>();
  for (const target of dataset.targets) {
    const rows = targetsByPeriod.get(target.period) ?? [];
    rows.push(target);
    targetsByPeriod.set(target.period, rows);
  }
  for (const period of dataset.periods) {
    const rows = targetsByPeriod.get(period) ?? [];
    if (rows.length !== targetsPerPeriod) {
      fail(
        `target periode ${period} ${rows.length}, harapan ${targetsPerPeriod}`,
      );
    }
    const global = rows.find(
      (target) => target.organizationN === null && target.subTheme === null,
    );
    if (!global) fail(`target global ${period} tidak ada`);
    const globalTarget = global!.targetCount;
    const organizationSum = rows
      .filter((target) => target.organizationN !== null)
      .reduce((sum, target) => sum + target.targetCount, 0);
    if (organizationSum !== globalTarget) {
      fail(`target instansi ${period} tidak sama dengan global`);
    }
    const subThemeSum = rows
      .filter((target) => target.subTheme !== null)
      .reduce((sum, target) => sum + target.targetCount, 0);
    if (subThemeSum !== globalTarget) {
      fail(`target sub-tema ${period} tidak sama dengan global`);
    }
    const age = dataset.periods.indexOf(period);
    for (const organization of dataset.organizations) {
      const row = rows.find(
        (target) =>
          target.organizationN === organization.n && target.subTheme === null,
      );
      if (!row) fail(`target ${organization.name} periode ${period} tidak ada`);
      const approvedCount =
        approvedByOrganizationPeriod.get(`${organization.n}:${period}`) ?? 0;
      const expectedTarget = Math.max(
        1,
        approvedCount + targetDelta(age, organization.n),
      );
      if (row!.targetCount !== expectedTarget) {
        fail(`target ${organization.name} periode ${period} tidak sesuai`);
      }
    }
    for (const target of rows) {
      if (target.targetCount < 1) fail(`target ${period} tidak positif`);
    }
  }

  const nonDraftCount = dataset.submissions.filter(
    (submission) => submission.status !== "DRAFT",
  ).length;
  const resubmittedCount = dataset.submissions.filter(
    (submission) => submission.status === "SUBMITTED" && submission.version > 1,
  ).length;
  const decisionStatuses = new Set(["APPROVED", "REVISION_REQUIRED"]);
  const decisionReviews = dataset.submissions.filter((submission) =>
    decisionStatuses.has(submission.status),
  ).length;
  const expectedRevisions = nonDraftCount + resubmittedCount;
  const expectedReviews = decisionReviews + resubmittedCount;
  const expectedNotifications = counts.pending + expectedReviews + 5;
  const expectedAudits = expectedReviews + 3;
  const expectedMapPoints = dataset.submissions.filter(
    (submission) => submission.status !== "DRAFT" && !submission.archived,
  ).length;

  if (counts.revisions !== expectedRevisions) {
    fail(`revisi ${counts.revisions}, harapan ${expectedRevisions}`);
  }
  if (counts.reviews !== expectedReviews) {
    fail(`ulasan ${counts.reviews}, harapan ${expectedReviews}`);
  }
  if (counts.notifications !== expectedNotifications) {
    fail(
      `notifikasi ${counts.notifications}, harapan ${expectedNotifications}`,
    );
  }
  if (counts.outbox !== expectedNotifications) {
    fail(`outbox ${counts.outbox}, harapan ${expectedNotifications}`);
  }
  if (counts.audits !== expectedAudits) {
    fail(`audit ${counts.audits}, harapan ${expectedAudits}`);
  }
  if (counts.locations !== counts.submissions) {
    fail(`lokasi ${counts.locations}, harapan ${counts.submissions}`);
  }
  if (counts.mapPoints !== expectedMapPoints) {
    fail(`titik peta ${counts.mapPoints}, harapan ${expectedMapPoints}`);
  }

  const references = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const submission of dataset.submissions) {
    if (submission.dateCreated > today)
      fail(`tanggal konten ${submission.n} di masa depan`);
    if (!submission.dateCreated.startsWith(submission.period))
      fail(`periode konten ${submission.n}`);
    if (!/^DKS-\d{6}-D\d{4}$/.test(submission.referenceCode))
      fail(`kode referensi ${submission.n}`);
    if (references.has(submission.referenceCode))
      fail("kode referensi duplikat");
    references.add(submission.referenceCode);
    if (idempotencyKeys.has(submission.idempotencyKey))
      fail("idempotency duplikat");
    idempotencyKeys.add(submission.idempotencyKey);
    if (!submission.publishedUrl.startsWith("https://demo.dakosta.example/"))
      fail(`url konten ${submission.n}`);
    if (submission.narrative.length < 40)
      fail(`narasi konten ${submission.n} terlalu pendek`);
    if (detectPii(`${submission.title}\n${submission.narrative}`))
      fail(`PII pada konten ${submission.n}`);
    if (submission.status !== "DRAFT" && submission.submittedAt === null)
      fail(`konten ${submission.n} tanpa submittedAt`);
    if (submission.status === "APPROVED" && submission.approvedAt === null) {
      fail(`konten ${submission.n} tanpa approvedAt`);
    }
    if (
      submission.status === "SUBMITTED" &&
      submission.version > 1 &&
      submission.resubmissionCount !== 1
    ) {
      fail(`resubmission konten ${submission.n}`);
    }
    if (
      submission.mainTheme === "EDUFAST" &&
      submission.edufastPolicyN === null
    ) {
      fail(`konten EDUFAST ${submission.n} tanpa kebijakan`);
    }
    for (const instantValue of [
      submission.createdAt,
      submission.submittedAt,
      submission.approvedAt,
      submission.revokedAt,
      submission.updatedAt,
    ]) {
      if (instantValue && instantValue.getTime() > now.getTime())
        fail(`timestamp konten ${submission.n} di masa depan`);
    }
  }

  const reviewKeys = new Set<string>();
  for (const review of dataset.reviews) {
    const key = `${review.submissionN}:${review.version}:${review.action}`;
    if (reviewKeys.has(key)) fail("ulasan duplikat");
    reviewKeys.add(key);
    if (review.createdAt.getTime() > now.getTime())
      fail("timestamp ulasan di masa depan");
  }
  const revisionKeys = new Set<string>();
  for (const revision of dataset.revisions) {
    const key = `${revision.submissionN}:${revision.version}`;
    if (revisionKeys.has(key)) fail("revisi duplikat");
    revisionKeys.add(key);
  }

  const notificationKeys = new Set<string>();
  for (const notification of dataset.notifications) {
    if (notificationKeys.has(notification.dedupeKey))
      fail("notifikasi duplikat");
    notificationKeys.add(notification.dedupeKey);
    if (notification.createdAt.getTime() > now.getTime())
      fail("timestamp notifikasi di masa depan");
  }
  if (dataset.outbox.length !== dataset.notifications.length)
    fail("outbox tidak 1:1 dengan notifikasi");
  if (
    new Set(dataset.outbox.map((item) => item.eventKey)).size !==
    dataset.outbox.length
  ) {
    fail("event outbox duplikat");
  }
  const targetKeys = new Set<string>();
  for (const target of dataset.targets) {
    const key = `${target.period}:${target.organizationN ?? "-"}:${target.subTheme ?? "-"}`;
    if (targetKeys.has(key)) fail("target duplikat");
    targetKeys.add(key);
  }
  if (
    new Set(dataset.audits.map((item) => item.id)).size !==
    dataset.audits.length
  ) {
    fail("id audit duplikat");
  }
}
