import { assertDestructiveTargetAllowed, loadScriptEnv } from "./_env";

const scriptTarget = loadScriptEnv();

import { sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

import * as schema from "../src/db/schema";
import { DEMO_ACCOUNTS, getDemoSeedPassword } from "../src/lib/demo";

type SeedDb = NeonDatabase<typeof schema>;

const DAY_MS = 86_400_000;

function uuid(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const ids = {
  user: (n: number) => uuid("00000000", n),
  organization: (n: number) => uuid("10000000", n),
  submission: (n: number) => uuid("20000000", n),
  notification: (n: number) => uuid("30000000", n),
  location: (n: number) => uuid("40000000", n),
  theme: (n: number) => uuid("50000000", n),
  legacyRole: (n: number) => uuid("60000000", n),
  membership: (n: number) => uuid("70000000", n),
  target: (n: number) => uuid("80000000", n),
  review: (n: number) => uuid("90000000", n),
  revision: (n: number) => uuid("a0000000", n),
  audit: (n: number) => uuid("b0000000", n),
  account: (n: number) => uuid("c0000000", n),
  region: (n: number) => uuid("d0000000", n),
  branch: (n: number) => uuid("e0000000", n),
  policy: (n: number) => uuid("f0000000", n),
};

const MASTER = ids.user(1);
const REGIONAL_A = ids.user(2);
const BRANCH_A1 = ids.user(4);
const BRANCH_A2 = ids.user(5);
const BRANCH_B1 = ids.user(6);

function instantDaysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

const jakartaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDateDaysAgo(days: number): string {
  return jakartaDate.format(new Date(Date.now() - days * DAY_MS));
}

function monthPeriod(offsetMonths = 0): { key: string; start: string; end: string } {
  const today = localDateDaysAgo(0);
  const [year, month] = today.split("-").map(Number) as [number, number];
  const base = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  const targetYear = base.getUTCFullYear();
  const targetMonth = base.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const prefix = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  return {
    key: prefix,
    start: `${prefix}-01`,
    end: `${prefix}-${String(lastDay).padStart(2, "0")}`,
  };
}

const REGIONS = [
  { n: 1, code: "REG-JABAR", name: "Regional Jawa Barat" },
  { n: 2, code: "REG-DKI", name: "Regional DKI Jakarta" },
] as const;

const BRANCHES = [
  { n: 1, region: 1, code: "CBG-BDG-KOTA", name: "Cabang Bandung Kota" },
  { n: 2, region: 1, code: "CBG-BDG-KAB", name: "Cabang Kabupaten Bandung" },
  { n: 3, region: 2, code: "CBG-JKT-PST", name: "Cabang Jakarta Pusat" },
  { n: 4, region: 2, code: "CBG-JKT-UTR", name: "Cabang Jakarta Utara" },
] as const;

const USERS = [
  { n: 1, name: "Ratu Sevilla Hizriyah", email: DEMO_ACCOUNTS.admin.email, role: "MASTER_ADMIN", title: "Master Admin DAKOSTA" },
  { n: 2, name: "Ayu Larasati", email: DEMO_ACCOUNTS.regional.email, role: "REGIONAL_ADMIN", title: "Admin Regional Jawa Barat" },
  { n: 3, name: "Bima Prasetyo", email: DEMO_ACCOUNTS.regionalB.email, role: "REGIONAL_ADMIN", title: "Admin Regional DKI Jakarta" },
  { n: 4, name: "Citra Maharani", email: DEMO_ACCOUNTS.branch.email, role: "BRANCH_ADMIN", title: "Admin Cabang Bandung Kota" },
  { n: 5, name: "Damar Wijaya", email: "cabang.a2@demo.dakosta.local", role: "BRANCH_ADMIN", title: "Admin Cabang Kabupaten Bandung" },
  { n: 6, name: "Eka Nuraini", email: "cabang.b1@demo.dakosta.local", role: "BRANCH_ADMIN", title: "Admin Cabang Jakarta Pusat" },
  { n: 7, name: "Nadia Prameswari", email: DEMO_ACCOUNTS.client.email, role: "STAKEHOLDER", title: "Koordinator Konten Klinik Sehat Nusantara" },
  { n: 8, name: "Bagas Aryasatya", email: "mitra.cahaya@demo.dakosta.local", role: "STAKEHOLDER", title: "Humas Puskesmas Cahaya Sehat" },
  { n: 9, name: "Sekar Wulandari", email: "mitra.bunda@demo.dakosta.local", role: "STAKEHOLDER", title: "Tim Komunikasi Klinik Mitra Bunda" },
  { n: 10, name: "Fajar Ramadhan", email: "mitra.cimahi@demo.dakosta.local", role: "STAKEHOLDER", title: "Humas Puskesmas Cimahi" },
  { n: 11, name: "Gita Puspita", email: "mitra.jkt@demo.dakosta.local", role: "STAKEHOLDER", title: "Humas Puskesmas Jakarta Pusat" },
  { n: 12, name: "Rina Kartika", email: "mitra.prima@demo.dakosta.local", role: "STAKEHOLDER", title: "Humas Laboratorium Prima Diagnostik" },
] as const;

// scope: [role, regionId?, branchId?, organizationId?]
const MEMBERSHIPS: Array<{
  n: number;
  user: number;
  role: string;
  region: number | null;
  branch: number | null;
  organization: number | null;
}> = [
  { n: 1, user: 1, role: "MASTER_ADMIN", region: null, branch: null, organization: null },
  { n: 2, user: 2, role: "REGIONAL_ADMIN", region: 1, branch: null, organization: null },
  { n: 3, user: 3, role: "REGIONAL_ADMIN", region: 2, branch: null, organization: null },
  { n: 4, user: 4, role: "BRANCH_ADMIN", region: null, branch: 1, organization: null },
  { n: 5, user: 5, role: "BRANCH_ADMIN", region: null, branch: 2, organization: null },
  { n: 6, user: 6, role: "BRANCH_ADMIN", region: null, branch: 3, organization: null },
  { n: 7, user: 7, role: "STAKEHOLDER", region: null, branch: null, organization: 1 },
  { n: 8, user: 8, role: "STAKEHOLDER", region: null, branch: null, organization: 2 },
  { n: 9, user: 9, role: "STAKEHOLDER", region: null, branch: null, organization: 3 },
  { n: 10, user: 10, role: "STAKEHOLDER", region: null, branch: null, organization: 9 },
  { n: 11, user: 11, role: "STAKEHOLDER", region: null, branch: null, organization: 12 },
  { n: 12, user: 12, role: "STAKEHOLDER", region: null, branch: null, organization: 7 },
];

const ORGANIZATIONS = [
  { n: 1, branch: 1, name: "Klinik Sehat Nusantara", type: "FASKES", class: "FKTP", code: "FKTP-BDG-001", category: "FASKES", area: "Kecamatan Sumur Bandung", lat: -6.9147, lng: 107.6098, precision: "exact" },
  { n: 2, branch: 1, name: "Puskesmas Cahaya Sehat", type: "FASKES", class: "FKTP", code: "FKTP-BDG-002", category: "FASKES", area: "Kecamatan Coblong", lat: -6.8975, lng: 107.6102, precision: "exact" },
  { n: 3, branch: 1, name: "Klinik Mitra Bunda", type: "FASKES", class: "FKTP", code: "FKTP-BDG-003", category: "FASKES", area: "Kecamatan Lengkong", lat: -6.9331, lng: 107.5842, precision: "approximate" },
  { n: 4, branch: 1, name: "RSUD Bandung", type: "FASKES", class: "FKRTL", code: "FKRTL-BDG-001", category: "FASKES", area: "Kecamatan Regol", lat: -6.9387, lng: 107.6089, precision: "exact" },
  { n: 5, branch: 1, name: "Apotek Amanah Farma", type: "OTHER", class: null, code: null, category: "ORGANISASI", area: "Kecamatan Bandung Wetan", lat: -6.9021, lng: 107.6187, precision: "exact" },
  { n: 6, branch: 1, name: "Media Kesehatan Bandung", type: "OTHER", class: null, code: null, category: "MEDIA", area: "Kota Bandung", lat: -6.921, lng: 107.641, precision: "approximate" },
  { n: 7, branch: 2, name: "Laboratorium Prima Diagnostik", type: "FASKES", class: "FKRTL", code: "FKRTL-BDG-002", category: "FASKES", area: "Kecamatan Cicendo", lat: -6.8877, lng: 107.5982, precision: "exact" },
  { n: 8, branch: 2, name: "Organisasi Peduli Sehat", type: "OTHER", class: null, code: null, category: "ORGANISASI", area: "Kota Bandung", lat: -6.9552, lng: 107.6121, precision: "approximate" },
  { n: 9, branch: 2, name: "Puskesmas Cimahi Tengah", type: "FASKES", class: "FKTP", code: "FKTP-KBB-001", category: "FASKES", area: "Kecamatan Cimahi Tengah", lat: -6.8722, lng: 107.5425, precision: "exact" },
  { n: 10, branch: 1, name: "Dinas Kesehatan Kota Bandung", type: "PEMDA", class: null, code: null, category: "INSTANSI", area: "Kota Bandung", lat: -6.9175, lng: 107.6191, precision: "exact" },
  { n: 11, branch: 2, name: "Klinik Sehat Bersama", type: "FASKES", class: "FKTP", code: "FKTP-BDG-004", category: "FASKES", area: "Kecamatan Margahayu", lat: -6.9589, lng: 107.5712, precision: "approximate" },
  { n: 12, branch: 3, name: "Puskesmas Jakarta Pusat", type: "FASKES", class: "FKTP", code: "FKTP-JKT-001", category: "FASKES", area: "Kecamatan Gambir", lat: -6.1767, lng: 106.8272, precision: "exact" },
] as const;

const THEMES = [
  { n: 1, slug: "edukasi-jkn", name: "Edukasi JKN", description: "Pemahaman hak, alur, dan manfaat layanan JKN bagi peserta." },
  { n: 2, slug: "layanan-primer", name: "Layanan Primer", description: "Penguatan faskes primer, antrean, dan mutu layanan dasar." },
  { n: 3, slug: "kesehatan-ibu-anak", name: "Kesehatan Ibu & Anak", description: "Kehamilan, persalinan, tumbuh kembang, dan gizi anak." },
  { n: 4, slug: "pencegahan-penyakit", name: "Pencegahan Penyakit", description: "Skrining, imunisasi, dan kampanye hidup sehat." },
  { n: 5, slug: "transformasi-digital", name: "Transformasi Digital", description: "Layanan digital, data, dan transparansi informasi." },
] as const;

const CONTENT = [
  { title: "Edukasi alur rujukan berjenjang bagi peserta JKN", status: "APPROVED", days: 3, org: 1, type: "VIDEO", main: "EDUFAST", sub: "MOBILE_JKN" },
  { title: "Panduan memeriksa status kepesertaan JKN", status: "APPROVED", days: 7, org: 2, type: "INFOGRAFIS", main: "EDUFAST", sub: "ALUR_BEROBAT" },
  { title: "Skrining hipertensi gratis di balai warga", status: "APPROVED", days: 12, org: 3, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Kelas ibu hamil: gizi seimbang trimester ketiga", status: "APPROVED", days: 18, org: 7, type: "VIDEO", main: "NON_EDUFAST", sub: "EDUKATIF_PERSUASIF" },
  { title: "Antrean daring layanan primer kini lebih tertib", status: "APPROVED", days: 25, org: 9, type: "VIDEO", main: "NON_EDUFAST", sub: "MOBILE_JKN" },
  { title: "Testimoni peserta JKN setelah berobat di FKTP", status: "APPROVED", days: 33, org: 1, type: "VIDEO", main: "EDUFAST", sub: "TESTIMONI_PESERTA" },
  { title: "Alur berobat peserta JKN di fasilitas kesehatan", status: "APPROVED", days: 40, org: 2, type: "INFOGRAFIS", main: "EDUFAST", sub: "ALUR_BEROBAT" },
  { title: "Imunisasi dasar lengkap: jadwal dan manfaat", status: "APPROVED", days: 45, org: 12, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Pendampingan lansia di puskesmas pembantu", status: "APPROVED", days: 50, org: 3, type: "VIDEO", main: "NON_EDUFAST", sub: "KORPORAT" },
  { title: "Transparansi biaya layanan di klinik mitra", status: "APPROVED", days: 58, org: 7, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Nutrisi seimbang untuk anak usia sekolah", status: "APPROVED", days: 64, org: 9, type: "VIDEO", main: "NON_EDUFAST", sub: "EDUKATIF_PERSUASIF" },
  { title: "Pemeriksaan gigi berkala untuk keluarga", status: "APPROVED", days: 72, org: 12, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "KORPORAT" },
  { title: "Edukasi cuci tangan dan sanitasi dasar", status: "SUBMITTED", days: 1, org: 1, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Konsultasi dokter daring: kapan perlu?", status: "SUBMITTED", days: 2, org: 7, type: "VIDEO", main: "NON_EDUFAST", sub: "MOBILE_JKN" },
  { title: "Deteksi dini anemia pada remaja putri", status: "SUBMITTED", days: 4, org: 9, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "EDUKATIF_PERSUASIF" },
  { title: "Alur pengaduan layanan yang mudah", status: "IN_REVIEW", days: 6, org: 2, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Kesehatan mental remaja: ruang aman", status: "IN_REVIEW", days: 9, org: 12, type: "VIDEO", main: "NON_EDUFAST", sub: "EDUKATIF_PERSUASIF" },
  { title: "Pemeriksaan laboratorium tanpa antre", status: "REVISION_REQUIRED", days: 20, org: 3, type: "VIDEO", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Rujukan cepat untuk kasus darurat", status: "REVISION_REQUIRED", days: 27, org: 9, type: "INFOGRAFIS", main: "EDUFAST", sub: "ALUR_BEROBAT" },
  { title: "Kampanye vaksinasi dewasa", status: "REJECTED", days: 15, org: 7, type: "VIDEO", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Pola makan untuk penderita diabetes", status: "REJECTED", days: 44, org: 12, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "EDUKATIF_PERSUASIF" },
  { title: "Pendampingan persalinan aman", status: "REVOKED", days: 22, org: 1, type: "VIDEO", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Rekam medis elektronik dan privasi pasien", status: "ARCHIVED", days: 60, org: 2, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "INFORMASI" },
  { title: "Gotong royong sehat di lingkungan RT", status: "DRAFT", days: 0, org: 3, type: "INFOGRAFIS", main: "NON_EDUFAST", sub: "KORPORAT" },
] as const;

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "WEBSITE", "TIKTOK", "YOUTUBE", "X", "LAINNYA"] as const;

const JITTER = [
  [0.0006, 0.0004],
  [-0.0009, 0.0011],
  [0.0013, -0.0007],
  [-0.0004, -0.0012],
  [0.0008, 0.0009],
  [-0.0011, 0.0002],
  [0.0003, -0.0015],
  [-0.0007, 0.0006],
] as const;

function decisionReason(status: string): string | null {
  switch (status) {
    case "APPROVED":
      return "Konten sesuai tema, tautan aktif, dan lokasi terverifikasi.";
    case "REVISION_REQUIRED":
      return "Mohon lengkapi tautan publikasi dan perjelas sumber data pendukung.";
    case "REJECTED":
      return "Konten di luar cakupan tema dan tidak dapat diverifikasi.";
    case "REVOKED":
      return "Konten ditarik oleh Master Admin karena permintaan koreksi organisasi.";
    case "ARCHIVED":
      return "Konten diarsipkan karena periode kampanye berakhir.";
    default:
      return null;
  }
}

function hasDecision(status: string): boolean {
  return ["APPROVED", "REVOKED", "ARCHIVED", "REJECTED", "REVISION_REQUIRED"].includes(status);
}

function reviewerFor(orgN: number): string {
  const branch = ORGANIZATIONS[orgN - 1]!.branch;
  if (branch === 1) return BRANCH_A1;
  if (branch === 2) return BRANCH_A2;
  return BRANCH_B1;
}

export async function runSeed(db: SeedDb): Promise<void> {
  const passwordHash = await hashPassword(getDemoSeedPassword());
  const now = new Date();
  const currentPeriod = monthPeriod(0);
  const previousPeriod = monthPeriod(-1);

  await db
    .insert(schema.regionalOffices)
    .values(
      REGIONS.map((region) => ({
        id: ids.region(region.n),
        code: region.code,
        name: region.name,
        status: "ACTIVE",
        createdAt: instantDaysAgo(200),
        updatedAt: instantDaysAgo(200),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.branchOffices)
    .values(
      BRANCHES.map((branch) => ({
        id: ids.branch(branch.n),
        regionalOfficeId: ids.region(branch.region),
        code: branch.code,
        name: branch.name,
        status: "ACTIVE",
        createdAt: instantDaysAgo(200),
        updatedAt: instantDaysAgo(200),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.user)
    .values(
      USERS.map((u) => ({
        id: ids.user(u.n),
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role === "MASTER_ADMIN" ? "admin" : "user",
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.account)
    .values(
      USERS.map((u) => ({
        id: ids.account(u.n),
        accountId: ids.user(u.n),
        providerId: "credential",
        userId: ids.user(u.n),
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userProfiles)
    .values(
      USERS.map((u) => ({
        userId: ids.user(u.n),
        mustChangePassword: false,
        isDemo: true,
        active: true,
        status: "ACTIVE",
        displayTitle: u.title,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userRoleMemberships)
    .values(
      USERS.map((u) => ({
        id: ids.legacyRole(u.n),
        userId: ids.user(u.n),
        role: u.role === "MASTER_ADMIN" ? "ADMIN" : "CLIENT",
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.stakeholders)
    .values(
      ORGANIZATIONS.map((o) => ({
        id: ids.organization(o.n),
        name: o.name,
        category: o.category,
        branchOfficeId: ids.branch(o.branch),
        organizationType: o.type,
        faskesClass: o.class,
        faskesCode: o.code,
        faskesCodeNormalized: o.code ? o.code.toUpperCase() : null,
        faskesType: o.type === "FASKES" ? (o.class === "FKTP" ? "PUSKESMAS" : "RUMAH_SAKIT") : null,
        serviceArea: o.area,
        addressLabel: `${o.name}, ${o.area}`,
        latitude: o.lat,
        longitude: o.lng,
        locationPrecision: o.precision,
        status: "ACTIVE",
        isDemo: true,
        joinedAt: localDateDaysAgo(180),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userMemberships)
    .values(
      MEMBERSHIPS.map((m) => ({
        id: ids.membership(m.n),
        userId: ids.user(m.user),
        role: m.role,
        regionalOfficeId: m.region ? ids.region(m.region) : null,
        branchOfficeId: m.branch ? ids.branch(m.branch) : null,
        organizationId: m.organization ? ids.organization(m.organization) : null,
        effectiveAt: instantDaysAgo(180),
        createdBy: MASTER,
        createdAt: instantDaysAgo(180),
        updatedAt: instantDaysAgo(180),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userStakeholderMemberships)
    .values(
      MEMBERSHIPS.filter((m) => m.organization).map((m) => ({
        id: ids.membership(m.n),
        userId: ids.user(m.user),
        stakeholderId: ids.organization(m.organization!),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.themes)
    .values(
      THEMES.map((t) => ({
        id: ids.theme(t.n),
        slug: t.slug,
        name: t.name,
        description: t.description,
        active: true,
        sortOrder: t.n,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.edufastMonthlyPolicies)
    .values([
      {
        id: ids.policy(1),
        periodYyyyMm: currentPeriod.key,
        timezone: "Asia/Jakarta",
        status: "PUBLISHED",
        version: 2,
        explanation:
          "Fokus EDUFAST bulan ini: pemanfaatan Mobile JKN, alur berobat, dan testimoni peserta.",
        createdBy: MASTER,
        publishedBy: MASTER,
        publishedAt: instantDaysAgo(12),
        createdAt: instantDaysAgo(20),
        updatedAt: instantDaysAgo(12),
      },
      {
        id: ids.policy(2),
        periodYyyyMm: previousPeriod.key,
        timezone: "Asia/Jakarta",
        status: "PUBLISHED",
        version: 1,
        explanation:
          "Fokus EDUFAST bulan sebelumnya: informasi layanan dan konten edukatif persuasif.",
        createdBy: MASTER,
        publishedBy: MASTER,
        publishedAt: instantDaysAgo(45),
        createdAt: instantDaysAgo(50),
        updatedAt: instantDaysAgo(45),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.edufastPolicySubthemes)
    .values([
      { policyId: ids.policy(1), subTheme: "MOBILE_JKN" },
      { policyId: ids.policy(1), subTheme: "ALUR_BEROBAT" },
      { policyId: ids.policy(1), subTheme: "TESTIMONI_PESERTA" },
      { policyId: ids.policy(2), subTheme: "INFORMASI" },
      { policyId: ids.policy(2), subTheme: "EDUKATIF_PERSUASIF" },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.edufastPolicyEvents)
    .values([
      {
        id: ids.audit(5),
        policyId: ids.policy(1),
        action: "PUBLISHED",
        actorId: MASTER,
        snapshot: { period: currentPeriod.key, version: 2 },
        createdAt: instantDaysAgo(12),
      },
      {
        id: ids.audit(6),
        policyId: ids.policy(2),
        action: "PUBLISHED",
        actorId: MASTER,
        snapshot: { period: previousPeriod.key, version: 1 },
        createdAt: instantDaysAgo(45),
      },
    ])
    .onConflictDoNothing();

  const locationRows = CONTENT.map((item, index) => {
    const organization = ORGANIZATIONS[item.org - 1]!;
    const jitter = JITTER[index % JITTER.length]!;
    const isGps = index % 3 === 0;
    return {
      id: ids.location(index + 1),
      latitude: organization.lat + jitter[0],
      longitude: organization.lng + jitter[1],
      label: `${organization.name} — titik konten DEMO`,
      source: isGps ? "device_gps" : "manual_pin",
      accuracyMeters: isGps ? 25 : null,
      consentAt: isGps ? instantDaysAgo(2) : null,
      verifiedStatus: isGps ? "VERIFIED" : "MANUAL_UNVERIFIED",
      precision: isGps ? "exact" : "approximate",
    };
  });

  await db.insert(schema.locations).values(locationRows).onConflictDoNothing();

  const submissionRows = CONTENT.map((item, index) => {
    const ownerMembership = MEMBERSHIPS.find((m) => m.organization === item.org)!;
    const owner = ids.user(ownerMembership.user);
    const submitted = item.status !== "DRAFT";
    const decided = hasDecision(item.status);
    const reviewer = reviewerFor(item.org);
    const isEdufast = item.main === "EDUFAST";
    const policyId = isEdufast ? ids.policy(1) : null;
    return {
      id: ids.submission(index + 1),
      referenceCode: `DKS-DEMO-${String(index + 1).padStart(4, "0")}`,
      stakeholderId: ids.organization(item.org),
      createdBy: owner,
      submittedBy: owner,
      onBehalfOf: null,
      title: item.title,
      narrative: `${item.title}. Konten demonstrasi sintetis untuk memperlihatkan alur pelaporan, validasi berjenjang, dan perhitungan capaian yang hanya memakai data berlabel DEMO. Tidak memuat data pribadi, nomor identitas, maupun rekam medis.`,
      publishedUrl: `https://demo.dakosta.example/konten/${index + 1}`,
      normalizedUrl: `demo.dakosta.example/konten/${index + 1}`,
      normalizedUrlHash: `${String(index + 1).padStart(64, "0")}`,
      platform: PLATFORMS[index % PLATFORMS.length]!,
      contentType: item.type,
      mainTheme: item.main,
      subTheme: item.sub,
      edufastPolicyId: policyId,
      edufastPolicyVersion: policyId ? 2 : null,
      approvedSnapshot: item.status === "APPROVED" ? { theme: item.main, subTheme: item.sub, version: 1 } : null,
      approvedVersion: item.status === "APPROVED" ? 1 : null,
      themeId: ids.theme(((index % THEMES.length) + 1) as number),
      dateCreated: localDateDaysAgo(item.days + 4),
      publishedAt: localDateDaysAgo(item.days + 4),
      locationId: ids.location(index + 1),
      status: item.status,
      version: 1,
      idempotencyKey: `seed-submission-${String(index + 1).padStart(4, "0")}`,
      submittedAt: submitted ? instantDaysAgo(item.days + 2) : null,
      approvedAt: item.status === "APPROVED" ? instantDaysAgo(item.days) : null,
      revokedAt: item.status === "REVOKED" ? instantDaysAgo(item.days) : null,
      reviewedBy: decided ? reviewer : null,
      decisionReason: decisionReason(item.status),
      archived: item.status === "ARCHIVED",
      isDemo: true,
      createdAt: instantDaysAgo(item.days + 5),
      updatedAt: instantDaysAgo(item.days),
    };
  });

  await db.insert(schema.contentSubmissions).values(submissionRows).onConflictDoNothing();

  await db
    .insert(schema.contentRevisions)
    .values(
      [18, 19].map((n, index) => ({
        id: ids.revision(index + 1),
        submissionId: ids.submission(n),
        version: 1,
        snapshot: {
          title: CONTENT[n - 1]!.title,
          status: "SUBMITTED",
          note: "Snapshot versi pertama sebelum permintaan revisi.",
        },
        actorId: reviewerFor(CONTENT[n - 1]!.org),
        reason: "Permintaan revisi dari admin cabang DEMO.",
      })),
    )
    .onConflictDoNothing();

  const reviewTargets = submissionRows
    .map((row, index) => ({ row, n: index + 1 }))
    .filter(({ row }) => hasDecision(row.status));

  await db
    .insert(schema.contentReviews)
    .values(
      reviewTargets.map(({ row, n }, index) => {
        const action =
          row.status === "REVISION_REQUIRED" ? "REQUEST_REVISION" : row.status === "REJECTED" ? "REJECT" : "APPROVE";
        const branchId = ids.branch(ORGANIZATIONS[CONTENT[n - 1]!.org - 1]!.branch);
        return {
          id: ids.review(index + 1),
          submissionId: ids.submission(n),
          version: 1,
          reviewerId: row.reviewedBy ?? BRANCH_A1,
          action,
          checklist: {
            relevansiTema: action !== "REJECT",
            akurasiKonten: action === "APPROVE",
            kelengkapanTautan: action === "APPROVE",
            etikaDanPrivasi: true,
          },
          notes: row.decisionReason,
          previousStatus: action === "REJECT" ? "IN_REVIEW" : "SUBMITTED",
          nextStatus: row.status,
          conflictOfInterest: false,
          reviewerRole: "BRANCH_ADMIN",
          reviewerBranchId: branchId,
          decisionSource: "NORMAL",
          createdAt: instantDaysAgo(CONTENT[n - 1]!.days),
        };
      }),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.kpiTargets)
    .values([
      {
        id: ids.target(1),
        workspaceLabel: "Workspace",
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
        targetCount: 30,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
      {
        id: ids.target(2),
        workspaceLabel: "Klinik Sehat Nusantara",
        stakeholderId: ids.organization(1),
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
        targetCount: 4,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
      {
        id: ids.target(3),
        workspaceLabel: "Puskesmas Cahaya Sehat",
        stakeholderId: ids.organization(2),
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
        targetCount: 4,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
      {
        id: ids.target(4),
        workspaceLabel: "Tema Mobile JKN",
        subTheme: "MOBILE_JKN",
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
        targetCount: 12,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
      {
        id: ids.target(5),
        workspaceLabel: "Klinik Sehat Nusantara · Mobile JKN",
        stakeholderId: ids.organization(1),
        subTheme: "MOBILE_JKN",
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
        targetCount: 2,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
      {
        id: ids.target(6),
        workspaceLabel: "Workspace",
        periodStart: previousPeriod.start,
        periodEnd: previousPeriod.end,
        targetCount: 24,
        reportingUnit: "konten",
        createdBy: MASTER,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.notifications)
    .values([
      {
        id: ids.notification(1),
        recipientId: BRANCH_A1,
        eventType: "CONTENT_SUBMITTED",
        title: "Konten baru menunggu review",
        body: "Klinik Sehat Nusantara mengirim DKS-DEMO-0013 untuk ditinjau.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(13),
        href: `/cabang/review/${ids.submission(13)}`,
        branchOfficeId: ids.branch(1),
        organizationId: ids.organization(1),
        dedupeKey: "seed:notif:a1:submission-13",
        createdAt: instantDaysAgo(1),
      },
      {
        id: ids.notification(2),
        recipientId: BRANCH_A2,
        eventType: "CONTENT_SUBMITTED",
        title: "Konten baru menunggu review",
        body: "Laboratorium Prima Diagnostik mengirim DKS-DEMO-0014 untuk ditinjau.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(14),
        href: `/cabang/review/${ids.submission(14)}`,
        branchOfficeId: ids.branch(2),
        organizationId: ids.organization(7),
        dedupeKey: "seed:notif:a2:submission-14",
        createdAt: instantDaysAgo(2),
      },
      {
        id: ids.notification(3),
        recipientId: BRANCH_B1,
        eventType: "CONTENT_SUBMITTED",
        title: "Konten baru menunggu review",
        body: "Puskesmas Jakarta Pusat mengirim DKS-DEMO-0017 untuk ditinjau.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(17),
        href: `/cabang/review/${ids.submission(17)}`,
        branchOfficeId: ids.branch(3),
        organizationId: ids.organization(12),
        dedupeKey: "seed:notif:b1:submission-17",
        createdAt: instantDaysAgo(3),
      },
      {
        id: ids.notification(4),
        recipientId: REGIONAL_A,
        eventType: "SLA_REMINDER",
        title: "Antrean review mendekati SLA",
        body: "Cabang Bandung Kota memiliki konten yang menunggu lebih dari 5 hari.",
        objectType: "BRANCH",
        objectId: ids.branch(1),
        href: "/wilayah/cabang",
        branchOfficeId: ids.branch(1),
        dedupeKey: "seed:notif:regional-a:sla",
        createdAt: instantDaysAgo(2),
      },
      {
        id: ids.notification(5),
        recipientId: ids.user(7),
        eventType: "SUBMISSION_APPROVED",
        title: "Konten disetujui",
        body: "Edukasi alur rujukan berjenjang telah disetujui admin cabang.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(1),
        href: `/client/konten/${ids.submission(1)}`,
        branchOfficeId: ids.branch(1),
        organizationId: ids.organization(1),
        readAt: instantDaysAgo(1),
        dedupeKey: "seed:notif:client-1:approved",
        createdAt: instantDaysAgo(3),
      },
      {
        id: ids.notification(6),
        recipientId: ids.user(9),
        eventType: "REVISION_REQUIRED",
        title: "Konten perlu revisi",
        body: "Pemeriksaan laboratorium tanpa antre memerlukan perbaikan tautan.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(18),
        href: `/client/konten/${ids.submission(18)}`,
        branchOfficeId: ids.branch(1),
        organizationId: ids.organization(3),
        dedupeKey: "seed:notif:client-3:revision",
        createdAt: instantDaysAgo(20),
      },
      {
        id: ids.notification(7),
        recipientId: ids.user(10),
        eventType: "SUBMISSION_APPROVED",
        title: "Konten disetujui",
        body: "Antrean daring layanan primer telah disetujui dan dihitung dalam capaian.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(5),
        href: `/client/konten/${ids.submission(5)}`,
        branchOfficeId: ids.branch(2),
        organizationId: ids.organization(9),
        readAt: instantDaysAgo(4),
        dedupeKey: "seed:notif:client-4:approved",
        createdAt: instantDaysAgo(25),
      },
      {
        id: ids.notification(8),
        recipientId: ids.user(11),
        eventType: "SUBMISSION_REJECTED",
        title: "Konten ditolak",
        body: "Pola makan untuk penderita diabetes ditolak karena di luar cakupan tema.",
        objectType: "CONTENT_SUBMISSION",
        objectId: ids.submission(21),
        href: `/client/konten/${ids.submission(21)}`,
        branchOfficeId: ids.branch(3),
        organizationId: ids.organization(12),
        dedupeKey: "seed:notif:client-5:rejected",
        createdAt: instantDaysAgo(44),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.auditLogs)
    .values([
      {
        id: ids.audit(1),
        actorId: MASTER,
        actorRole: "MASTER_ADMIN",
        action: "SEED_OPERATIONAL_FIXTURES",
        recordType: "WORKSPACE",
        recordId: "staging-v4",
        after: {
          regions: REGIONS.length,
          branches: BRANCHES.length,
          organizations: ORGANIZATIONS.length,
          submissions: CONTENT.length,
        },
        source: "SEED",
      },
      {
        id: ids.audit(2),
        actorId: BRANCH_A1,
        actorRole: "BRANCH_ADMIN",
        action: "CONTENT_APPROVED",
        recordType: "CONTENT_SUBMISSION",
        recordId: ids.submission(1),
        regionId: ids.region(1),
        branchId: ids.branch(1),
        organizationId: ids.organization(1),
        after: { status: "APPROVED" },
        source: "SEED",
      },
      {
        id: ids.audit(3),
        actorId: BRANCH_B1,
        actorRole: "BRANCH_ADMIN",
        action: "CONTENT_REJECTED",
        recordType: "CONTENT_SUBMISSION",
        recordId: ids.submission(21),
        regionId: ids.region(2),
        branchId: ids.branch(3),
        organizationId: ids.organization(12),
        after: { status: "REJECTED" },
        source: "SEED",
      },
      {
        id: ids.audit(4),
        actorId: MASTER,
        actorRole: "MASTER_ADMIN",
        action: "EDUFAST_POLICY_PUBLISHED",
        recordType: "EDUFAST_POLICY",
        recordId: ids.policy(1),
        regionId: ids.region(1),
        after: { period: currentPeriod.key, version: 2 },
        source: "SEED",
      },
    ])
    .onConflictDoNothing();

  await assertSeedCounts(db);
}

async function count(db: SeedDb, table: string, where = ""): Promise<number> {
  const result = await db.execute(sql.raw(`select count(*)::int as value from ${table} ${where}`));
  const rows = result.rows as unknown as Array<{ value: number | string }>;
  return Number(rows[0]?.value ?? 0);
}

async function assertSeedCounts(db: SeedDb): Promise<void> {
  const expectations: Array<{ label: string; actual: number; expected: number }> = [
    { label: "wilayah", actual: await count(db, "regional_offices"), expected: 2 },
    { label: "cabang", actual: await count(db, "branch_offices"), expected: 4 },
    { label: "pengguna demo", actual: await count(db, "user_profiles", "where is_demo = true"), expected: 12 },
    { label: "keanggotaan aktif", actual: await count(db, "user_memberships", "where revoked_at is null"), expected: 12 },
    { label: "organisasi", actual: await count(db, "stakeholders", "where is_demo = true"), expected: 12 },
    { label: "faskes", actual: await count(db, "stakeholders", "where organization_type = 'FASKES'"), expected: 8 },
    { label: "kebijakan EDUFAST", actual: await count(db, "edufast_monthly_policies"), expected: 2 },
    { label: "sub-tema kebijakan", actual: await count(db, "edufast_policy_subthemes"), expected: 5 },
    { label: "lokasi", actual: await count(db, "locations"), expected: 24 },
    { label: "konten", actual: await count(db, "content_submissions", "where is_demo = true"), expected: 24 },
    { label: "konten disetujui", actual: await count(db, "content_submissions", "where is_demo = true and status = 'APPROVED'"), expected: 12 },
    { label: "konten EDUFAST", actual: await count(db, "content_submissions", "where is_demo = true and main_theme = 'EDUFAST'"), expected: 5 },
    { label: "konten terkirim", actual: await count(db, "content_submissions", "where is_demo = true and status = 'SUBMITTED'"), expected: 3 },
    { label: "konten ditinjau", actual: await count(db, "content_submissions", "where is_demo = true and status = 'IN_REVIEW'"), expected: 2 },
    { label: "konten revisi", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REVISION_REQUIRED'"), expected: 2 },
    { label: "konten ditolak", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REJECTED'"), expected: 2 },
    { label: "konten dicabut", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REVOKED'"), expected: 1 },
    { label: "konten diarsipkan", actual: await count(db, "content_submissions", "where is_demo = true and status = 'ARCHIVED'"), expected: 1 },
    { label: "draf", actual: await count(db, "content_submissions", "where is_demo = true and status = 'DRAFT'"), expected: 1 },
    { label: "ulasan", actual: await count(db, "content_reviews"), expected: 18 },
    { label: "revisi", actual: await count(db, "content_revisions"), expected: 2 },
    { label: "target KPI", actual: await count(db, "kpi_targets"), expected: 6 },
    { label: "notifikasi", actual: await count(db, "notifications"), expected: 8 },
  ];

  const mismatches = expectations.filter((row) => row.actual !== row.expected);
  for (const row of expectations) {
    console.log(`  ${row.actual === row.expected ? "OK " : "FAIL"} ${row.label}: ${row.actual} (harapan ${row.expected})`);
  }

  if (mismatches.length > 0) {
    throw new Error(`Seed tidak sesuai harapan: ${mismatches.map((m) => m.label).join(", ")}`);
  }

  console.log(`KPI demo (disetujui saja): ${expectations.find((row) => row.label === "konten disetujui")?.actual ?? 0} konten.`);
}

async function main(): Promise<void> {
  assertDestructiveTargetAllowed(scriptTarget, "Seed demo");
  const runtimeEnv = process.env.APP_ENV ?? process.env.VERCEL_ENV;
  if (runtimeEnv === "production") {
    throw new Error("Seed demo dilarang di production. Tidak ada perubahan yang dilakukan.");
  }

  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    await runSeed(db);
    console.log("Seed DEMO selesai dan seluruh hitungan terverifikasi.");
  } finally {
    await pool.end();
  }
}

const entry = process.argv[1]?.replace(/\\/g, "/");
if (entry && import.meta.url.endsWith(entry.split("/").pop()!)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
