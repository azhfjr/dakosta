import { config } from "dotenv";

config({ path: ".env.local" });
config();

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
  admin: uuid("00000000", 1),
  client1: uuid("00000000", 2),
  client2: uuid("00000000", 3),
  client3: uuid("00000000", 4),
  account: (n: number) => uuid("c0000000", n),
  stakeholder: (n: number) => uuid("10000000", n),
  submission: (n: number) => uuid("20000000", n),
  notification: (n: number) => uuid("30000000", n),
  location: (n: number) => uuid("40000000", n),
  theme: (n: number) => uuid("50000000", n),
  role: (n: number) => uuid("60000000", n),
  membership: (n: number) => uuid("70000000", n),
  target: (n: number) => uuid("80000000", n),
  review: (n: number) => uuid("90000000", n),
  revision: (n: number) => uuid("a0000000", n),
  audit: (n: number) => uuid("b0000000", n),
};

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

function monthBoundsJakarta(offsetMonths = 0): { start: string; end: string } {
  const today = localDateDaysAgo(0);
  const [year, month] = today.split("-").map(Number) as [number, number];
  const base = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  const targetYear = base.getUTCFullYear();
  const targetMonth = base.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const prefix = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  return {
    start: `${prefix}-01`,
    end: `${prefix}-${String(lastDay).padStart(2, "0")}`,
  };
}

const USERS = [
  {
    id: ids.admin,
    name: "Ratu Sevilla Hizriyah",
    email: DEMO_ACCOUNTS.admin.email,
    role: "admin" as const,
    title: "Administrator Demo",
  },
  {
    id: ids.client1,
    name: "Nadia Prameswari",
    email: DEMO_ACCOUNTS.client.email,
    role: "user" as const,
    title: "Koordinator Konten Mitra",
  },
  {
    id: ids.client2,
    name: "Bagas Aryasatya",
    email: "mitra.cahaya@demo.dakosta.local",
    role: "user" as const,
    title: "Humas Faskes Mitra",
  },
  {
    id: ids.client3,
    name: "Sekar Wulandari",
    email: "mitra.harapan@demo.dakosta.local",
    role: "user" as const,
    title: "Tim Komunikasi Mitra",
  },
];

const STAKEHOLDERS = [
  {
    id: ids.stakeholder(1),
    client: ids.client1,
    name: "Klinik Sehat Nusantara",
    category: "FASKES",
    faskesType: "KLINIK",
    serviceArea: "Kecamatan Sumur Bandung",
    addressLabel: "Jl. Merdeka No. 12, Bandung",
    latitude: -6.9147,
    longitude: 107.6098,
    precision: "exact",
  },
  {
    id: ids.stakeholder(2),
    client: ids.client2,
    name: "Puskesmas Cahaya Sehat",
    category: "FASKES",
    faskesType: "PUSKESMAS",
    serviceArea: "Kecamatan Coblong",
    addressLabel: "Jl. Dipati Ukur No. 45, Bandung",
    latitude: -6.8975,
    longitude: 107.6102,
    precision: "exact",
  },
  {
    id: ids.stakeholder(3),
    client: ids.client3,
    name: "Klinik Mitra Bunda",
    category: "FASKES",
    faskesType: "KLINIK",
    serviceArea: "Kecamatan Lengkong",
    addressLabel: "Jl. Buah Batu No. 88, Bandung",
    latitude: -6.9331,
    longitude: 107.5842,
    precision: "approximate",
  },
  {
    id: ids.stakeholder(4),
    client: ids.client3,
    name: "Posyandu Melati",
    category: "FASKES",
    faskesType: "POSYANDU",
    serviceArea: "Kecamatan Kiaracondong",
    addressLabel: "Balai RW 07, Kiaracondong, Bandung",
    latitude: -6.945,
    longitude: 107.635,
    precision: "exact",
  },
  {
    id: ids.stakeholder(5),
    client: ids.client1,
    name: "Apotek Amanah Farma",
    category: "FASKES",
    faskesType: "APOTEK",
    serviceArea: "Kecamatan Bandung Wetan",
    addressLabel: "Jl. Aceh No. 21, Bandung",
    latitude: -6.9021,
    longitude: 107.6187,
    precision: "exact",
  },
  {
    id: ids.stakeholder(6),
    client: ids.client2,
    name: "Media Kesehatan Bandung",
    category: "MEDIA",
    faskesType: null,
    serviceArea: "Kota Bandung",
    addressLabel: "Jl. Asia Afrika No. 5, Bandung",
    latitude: -6.921,
    longitude: 107.641,
    precision: "approximate",
  },
  {
    id: ids.stakeholder(7),
    client: ids.client1,
    name: "Laboratorium Prima Diagnostik",
    category: "FASKES",
    faskesType: "LABORATORIUM",
    serviceArea: "Kecamatan Cicendo",
    addressLabel: "Jl. Pasirkaliki No. 101, Bandung",
    latitude: -6.8877,
    longitude: 107.5982,
    precision: "exact",
  },
  {
    id: ids.stakeholder(8),
    client: ids.client3,
    name: "Organisasi Peduli Sehat",
    category: "ORGANISASI",
    faskesType: null,
    serviceArea: "Kota Bandung",
    addressLabel: "Sekretariat Jl. Sunda No. 9, Bandung",
    latitude: -6.9552,
    longitude: 107.6121,
    precision: "approximate",
  },
];

const THEMES = [
  {
    id: ids.theme(1),
    slug: "edukasi-jkn",
    name: "Edukasi JKN",
    description: "Pemahaman hak, alur, dan manfaat layanan JKN bagi peserta.",
  },
  {
    id: ids.theme(2),
    slug: "layanan-primer",
    name: "Layanan Primer",
    description: "Penguatan faskes primer, antrean, dan mutu layanan dasar.",
  },
  {
    id: ids.theme(3),
    slug: "kesehatan-ibu-anak",
    name: "Kesehatan Ibu & Anak",
    description: "Kehamilan, persalinan, tumbuh kembang, dan gizi anak.",
  },
  {
    id: ids.theme(4),
    slug: "pencegahan-penyakit",
    name: "Pencegahan Penyakit",
    description: "Skrining, imunisasi, dan kampanye hidup sehat.",
  },
  {
    id: ids.theme(5),
    slug: "transformasi-digital",
    name: "Transformasi Digital",
    description: "Layanan digital, data, dan transparansi informasi.",
  },
];

const CONTENT = [
  { title: "Edukasi alur rujukan berjenjang bagi peserta JKN", status: "APPROVED", days: 3 },
  { title: "Panduan memeriksa status kepesertaan JKN", status: "APPROVED", days: 7 },
  { title: "Skrining hipertensi gratis di balai warga", status: "APPROVED", days: 12 },
  { title: "Kelas ibu hamil: gizi seimbang trimester ketiga", status: "APPROVED", days: 18 },
  { title: "Antrean daring layanan primer kini lebih tertib", status: "APPROVED", days: 25 },
  { title: "Mitos dan fakta seputar JKN", status: "APPROVED", days: 33 },
  { title: "Imunisasi dasar lengkap: jadwal dan manfaat", status: "APPROVED", days: 40 },
  { title: "Pendampingan lansia di puskesmas pembantu", status: "APPROVED", days: 48 },
  { title: "Cerita kader posyandu mendampingi ibu baru", status: "APPROVED", days: 55 },
  { title: "Transparansi biaya layanan di klinik mitra", status: "APPROVED", days: 63 },
  { title: "Nutrisi seimbang untuk anak usia sekolah", status: "APPROVED", days: 72 },
  { title: "Pemeriksaan gigi berkala untuk keluarga", status: "APPROVED", days: 100 },
  { title: "Edukasi cuci tangan dan sanitasi dasar", status: "SUBMITTED", days: 1 },
  { title: "Konsultasi dokter daring: kapan perlu?", status: "SUBMITTED", days: 2 },
  { title: "Deteksi dini anemia pada remaja putri", status: "SUBMITTED", days: 4 },
  { title: "Alur pengaduan layanan yang mudah", status: "IN_REVIEW", days: 6 },
  { title: "Kesehatan mental remaja: ruang aman", status: "IN_REVIEW", days: 9 },
  { title: "Pemeriksaan laboratorium tanpa antre", status: "REVISION_REQUIRED", days: 20 },
  { title: "Rujukan cepat untuk kasus darurat", status: "REVISION_REQUIRED", days: 37 },
  { title: "Kampanye vaksinasi dewasa", status: "REJECTED", days: 15 },
  { title: "Pola makan untuk penderita diabetes", status: "REJECTED", days: 44 },
  { title: "Pendampingan persalinan aman", status: "REVOKED", days: 22 },
  { title: "Rekam medis elektronik dan privasi pasien", status: "ARCHIVED", days: 60 },
  { title: "Gotong royong sehat di lingkungan RT", status: "DRAFT", days: 0 },
] as const;

const PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "WEBSITE",
  "TIKTOK",
  "YOUTUBE",
  "X",
  "LAINNYA",
] as const;

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
      return "Konten ditarik oleh stakeholder setelah tinjauan ulang.";
    case "ARCHIVED":
      return "Konten diarsipkan karena periode kampanye berakhir.";
    default:
      return null;
  }
}

function hasDecision(status: string): boolean {
  return [
    "APPROVED",
    "REVOKED",
    "ARCHIVED",
    "REJECTED",
    "REVISION_REQUIRED",
  ].includes(status);
}

export async function runSeed(db: SeedDb): Promise<void> {
  const passwordHash = await hashPassword(getDemoSeedPassword());
  const now = new Date();

  await db
    .insert(schema.user)
    .values(
      USERS.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.account)
    .values(
      USERS.map((u, index) => ({
        id: ids.account(index + 1),
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
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
        userId: u.id,
        mustChangePassword: false,
        isDemo: true,
        active: true,
        displayTitle: u.title,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userRoleMemberships)
    .values(
      USERS.map((u, index) => ({
        id: ids.role(index + 1),
        userId: u.id,
        role: u.role === "admin" ? "ADMIN" : "CLIENT",
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.stakeholders)
    .values(
      STAKEHOLDERS.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        faskesType: s.faskesType,
        serviceArea: s.serviceArea,
        addressLabel: s.addressLabel,
        latitude: s.latitude,
        longitude: s.longitude,
        locationPrecision: s.precision,
        status: "ACTIVE",
        isDemo: true,
        joinedAt: localDateDaysAgo(180),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.userStakeholderMemberships)
    .values(
      STAKEHOLDERS.map((s, index) => ({
        id: ids.membership(index + 1),
        userId: s.client,
        stakeholderId: s.id,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.themes)
    .values(
      THEMES.map((t, index) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        active: true,
        sortOrder: index + 1,
      })),
    )
    .onConflictDoNothing();

  const locationRows = CONTENT.map((_, index) => {
    const stakeholder = STAKEHOLDERS[index % STAKEHOLDERS.length]!;
    const jitter = JITTER[index % JITTER.length]!;
    const isGps = index % 3 === 0;
    return {
      id: ids.location(index + 1),
      latitude: stakeholder.latitude + jitter[0],
      longitude: stakeholder.longitude + jitter[1],
      label: `${stakeholder.name} — titik konten DEMO`,
      source: isGps ? "device_gps" : "manual_pin",
      accuracyMeters: isGps ? 25 : null,
      consentAt: isGps ? instantDaysAgo(2) : null,
      verifiedStatus: isGps ? "VERIFIED" : "MANUAL_UNVERIFIED",
      precision: isGps ? "exact" : "approximate",
    };
  });

  await db.insert(schema.locations).values(locationRows).onConflictDoNothing();

  const submissionRows = CONTENT.map((item, index) => {
    const stakeholder = STAKEHOLDERS[index % STAKEHOLDERS.length]!;
    const theme = THEMES[index % THEMES.length]!;
    const location = locationRows[index]!;
    const submitted = item.status !== "DRAFT";
    const decided = hasDecision(item.status);
    return {
      id: ids.submission(index + 1),
      referenceCode: `DKS-DEMO-${String(index + 1).padStart(4, "0")}`,
      stakeholderId: stakeholder.id,
      createdBy: stakeholder.client,
      submittedBy: stakeholder.client,
      onBehalfOf: null,
      title: item.title,
      narrative: `${item.title}. Konten demonstrasi sintetis untuk memperlihatkan alur pelaporan, validasi, dan perhitungan capaian yang hanya memakai data berlabel DEMO. Tidak memuat data pribadi, nomor identitas, maupun rekam medis.`,
      publishedUrl: `https://demo.dakosta.example/konten/${index + 1}`,
      normalizedUrl: `demo.dakosta.example/konten/${index + 1}`,
      normalizedUrlHash: `${String(index + 1).padStart(64, "0")}`,
      platform: PLATFORMS[index % PLATFORMS.length]!,
      themeId: theme.id,
      dateCreated: localDateDaysAgo(item.days + 4),
      publishedAt: localDateDaysAgo(item.days + 4),
      locationId: location.id,
      status: item.status,
      version: 1,
      idempotencyKey: `seed-submission-${String(index + 1).padStart(4, "0")}`,
      submittedAt: submitted ? instantDaysAgo(item.days + 2) : null,
      approvedAt: decided ? instantDaysAgo(item.days) : null,
      reviewedBy: decided ? ids.admin : null,
      decisionReason: decisionReason(item.status),
      archived: item.status === "ARCHIVED",
      isDemo: true,
      createdAt: instantDaysAgo(item.days + 5),
      updatedAt: instantDaysAgo(item.days),
    };
  });

  await db
    .insert(schema.contentSubmissions)
    .values(submissionRows)
    .onConflictDoNothing();

  const revisionTargets = [18, 19];
  await db
    .insert(schema.contentRevisions)
    .values(
      revisionTargets.map((n, index) => ({
        id: ids.revision(index + 1),
        submissionId: ids.submission(n),
        version: 1,
        snapshot: {
          title: CONTENT[n - 1]!.title,
          status: "SUBMITTED",
          note: "Snapshot versi pertama sebelum permintaan revisi.",
        },
        actorId: ids.admin,
        reason: "Permintaan revisi dari admin DEMO.",
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
          row.status === "REVISION_REQUIRED"
            ? "REQUEST_REVISION"
            : row.status === "REJECTED"
              ? "REJECT"
              : "APPROVE";
        return {
          id: ids.review(index + 1),
          submissionId: ids.submission(n),
          version: 1,
          reviewerId: ids.admin,
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
          createdAt: instantDaysAgo(CONTENT[n - 1]!.days),
        };
      }),
    )
    .onConflictDoNothing();

  const currentPeriod = monthBoundsJakarta();
  const previousPeriod = monthBoundsJakarta(-1);
  const stakeholderTargets = [5, 4, 4, 3, 4, 3, 4, 3];
  const themeTargets = [8, 7, 6, 5, 0];

  const targetRows = [
    {
      n: 1,
      stakeholderId: null,
      themeId: null,
      period: currentPeriod,
      targetCount: 30,
    },
    ...STAKEHOLDERS.map((stakeholder, index) => ({
      n: index + 2,
      stakeholderId: stakeholder.id,
      themeId: null,
      period: currentPeriod,
      targetCount: stakeholderTargets[index]!,
    })),
    ...THEMES.map((theme, index) => ({
      n: index + 10,
      stakeholderId: null,
      themeId: theme.id,
      period: currentPeriod,
      targetCount: themeTargets[index]!,
    })),
    {
      n: 15,
      stakeholderId: ids.stakeholder(1),
      themeId: ids.theme(1),
      period: currentPeriod,
      targetCount: 4,
    },
    {
      n: 16,
      stakeholderId: null,
      themeId: null,
      period: previousPeriod,
      targetCount: 24,
    },
  ];

  await db
    .insert(schema.kpiTargets)
    .values(
      targetRows.map((row) => ({
        id: ids.target(row.n),
        workspaceLabel: "Bandung Demo",
        stakeholderId: row.stakeholderId,
        themeId: row.themeId,
        periodStart: row.period.start,
        periodEnd: row.period.end,
        targetCount: row.targetCount,
        reportingUnit: "konten",
        createdBy: ids.admin,
      })),
    )
    .onConflictDoNothing();

  const notifications = [
    {
      n: 1,
      recipient: ids.admin,
      eventType: "SUBMISSION_CREATED",
      title: "Konten baru menunggu validasi",
      body: "Media Kesehatan Bandung mengirim konten untuk ditinjau.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(13),
      href: `/admin/validasi/${ids.submission(13)}`,
      readAt: null,
      dedupeKey: "seed:notif:admin:submission-13",
    },
    {
      n: 2,
      recipient: ids.admin,
      eventType: "SUBMISSION_CREATED",
      title: "Konten baru menunggu validasi",
      body: "Laboratorium Prima Diagnostik mengirim konten untuk ditinjau.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(14),
      href: `/admin/validasi/${ids.submission(14)}`,
      readAt: null,
      dedupeKey: "seed:notif:admin:submission-14",
    },
    {
      n: 3,
      recipient: ids.admin,
      eventType: "SLA_REMINDER",
      title: "Konten mendekati batas validasi",
      body: "Ada konten yang sudah lebih dari 5 hari menunggu keputusan.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(16),
      href: `/admin/validasi/${ids.submission(16)}`,
      readAt: instantDaysAgo(1),
      dedupeKey: "seed:notif:admin:sla-reminder",
    },
    {
      n: 4,
      recipient: ids.admin,
      eventType: "SUBMISSION_UPDATED",
      title: "Konten diperbarui stakeholder",
      body: "Alur pengaduan layanan yang mudah telah diperbarui.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(16),
      href: `/admin/validasi/${ids.submission(16)}`,
      readAt: null,
      dedupeKey: "seed:notif:admin:submission-16-updated",
    },
    {
      n: 5,
      recipient: ids.client1,
      eventType: "SUBMISSION_APPROVED",
      title: "Konten disetujui",
      body: "Edukasi alur rujukan berjenjang telah disetujui dan dihitung dalam capaian.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(1),
      href: `/client/konten/${ids.submission(1)}`,
      readAt: instantDaysAgo(1),
      dedupeKey: "seed:notif:client1:submission-1-approved",
    },
    {
      n: 6,
      recipient: ids.client1,
      eventType: "REVISION_REQUIRED",
      title: "Konten perlu revisi",
      body: "Pemeriksaan laboratorium tanpa antre memerlukan perbaikan tautan.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(18),
      href: `/client/konten/${ids.submission(18)}`,
      readAt: null,
      dedupeKey: "seed:notif:client1:submission-18-revision",
    },
    {
      n: 7,
      recipient: ids.client2,
      eventType: "SUBMISSION_APPROVED",
      title: "Konten disetujui",
      body: "Panduan memeriksa status kepesertaan JKN telah disetujui.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(2),
      href: `/client/konten/${ids.submission(2)}`,
      readAt: null,
      dedupeKey: "seed:notif:client2:submission-2-approved",
    },
    {
      n: 8,
      recipient: ids.client3,
      eventType: "SUBMISSION_REJECTED",
      title: "Konten ditolak",
      body: "Kampanye vaksinasi dewasa ditolak karena di luar cakupan tema.",
      objectType: "CONTENT_SUBMISSION",
      objectId: ids.submission(20),
      href: `/client/konten/${ids.submission(20)}`,
      readAt: null,
      dedupeKey: "seed:notif:client3:submission-20-rejected",
    },
  ];

  await db
    .insert(schema.notifications)
    .values(
      notifications.map((notification) => ({
        id: ids.notification(notification.n),
        recipientId: notification.recipient,
        eventType: notification.eventType,
        title: notification.title,
        body: notification.body,
        objectType: notification.objectType,
        objectId: notification.objectId,
        href: notification.href,
        readAt: notification.readAt,
        dedupeKey: notification.dedupeKey,
        createdAt: instantDaysAgo(notification.n),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.auditLogs)
    .values([
      {
        id: ids.audit(1),
        actorId: ids.admin,
        actorRole: "ADMIN",
        action: "SEED_DEMO_DATA",
        recordType: "WORKSPACE",
        recordId: "bandung-demo",
        after: { submissions: CONTENT.length, stakeholders: STAKEHOLDERS.length },
      },
      {
        id: ids.audit(2),
        actorId: ids.admin,
        actorRole: "ADMIN",
        action: "CONTENT_APPROVED",
        recordType: "CONTENT_SUBMISSION",
        recordId: ids.submission(1),
        after: { status: "APPROVED" },
      },
      {
        id: ids.audit(3),
        actorId: ids.admin,
        actorRole: "ADMIN",
        action: "CONTENT_REJECTED",
        recordType: "CONTENT_SUBMISSION",
        recordId: ids.submission(20),
        after: { status: "REJECTED" },
      },
      {
        id: ids.audit(4),
        actorId: ids.client3,
        actorRole: "CLIENT",
        action: "CONTENT_SUBMITTED",
        recordType: "CONTENT_SUBMISSION",
        recordId: ids.submission(13),
        after: { status: "SUBMITTED" },
      },
    ])
    .onConflictDoNothing();

  await assertSeedCounts(db);
}

async function count(db: SeedDb, table: string, where = ""): Promise<number> {
  const result = await db.execute(
    sql.raw(`select count(*)::int as value from ${table} ${where}`),
  );
  const rows = result.rows as unknown as Array<{ value: number | string }>;
  return Number(rows[0]?.value ?? 0);
}

async function assertSeedCounts(db: SeedDb): Promise<void> {
  const expectations: Array<{ label: string; actual: number; expected: number }> =
    [
      { label: "pengguna demo", actual: await count(db, "user_profiles", "where is_demo = true"), expected: 4 },
      { label: "stakeholder", actual: await count(db, "stakeholders", "where is_demo = true"), expected: 8 },
      { label: "tema", actual: await count(db, "themes"), expected: 5 },
      { label: "lokasi", actual: await count(db, "locations"), expected: 24 },
      { label: "konten", actual: await count(db, "content_submissions", "where is_demo = true"), expected: 24 },
      { label: "konten disetujui", actual: await count(db, "content_submissions", "where is_demo = true and status = 'APPROVED'"), expected: 12 },
      { label: "konten terkirim", actual: await count(db, "content_submissions", "where is_demo = true and status = 'SUBMITTED'"), expected: 3 },
      { label: "konten ditinjau", actual: await count(db, "content_submissions", "where is_demo = true and status = 'IN_REVIEW'"), expected: 2 },
      { label: "konten revisi", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REVISION_REQUIRED'"), expected: 2 },
      { label: "konten ditolak", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REJECTED'"), expected: 2 },
      { label: "konten dicabut", actual: await count(db, "content_submissions", "where is_demo = true and status = 'REVOKED'"), expected: 1 },
      { label: "konten diarsipkan", actual: await count(db, "content_submissions", "where is_demo = true and status = 'ARCHIVED'"), expected: 1 },
      { label: "draf", actual: await count(db, "content_submissions", "where is_demo = true and status = 'DRAFT'"), expected: 1 },
      { label: "ulasan", actual: await count(db, "content_reviews"), expected: 18 },
      { label: "revisi", actual: await count(db, "content_revisions"), expected: 2 },
      { label: "target KPI", actual: await count(db, "kpi_targets"), expected: 16 },
      { label: "notifikasi", actual: await count(db, "notifications"), expected: 8 },
    ];

  const mismatches = expectations.filter((row) => row.actual !== row.expected);
  for (const row of expectations) {
    console.log(
      `  ${row.actual === row.expected ? "OK " : "FAIL"} ${row.label}: ${row.actual} (harapan ${row.expected})`,
    );
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Seed tidak sesuai harapan: ${mismatches.map((m) => m.label).join(", ")}`,
    );
  }

  const approved = expectations.find((row) => row.label === "konten disetujui");
  console.log(`KPI demo (disetujui saja): ${approved?.actual ?? 0} konten.`);
}

async function main(): Promise<void> {
  if (process.env.VERCEL_ENV === "production" && process.env.SEED_CONFIRM !== "yes") {
    throw new Error(
      "Seed produksi memerlukan SEED_CONFIRM=yes. Tidak ada perubahan yang dilakukan.",
    );
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

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
