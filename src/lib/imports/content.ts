import "server-only";

import { createHash } from "node:crypto";

import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { AppRole } from "@/lib/authz/types";
import { toCsv } from "@/lib/csv";
import { assertEdufastSelection } from "@/lib/edufast/policy";
import { errors } from "@/lib/errors";
import { parseCsv } from "@/lib/imports/accounts";
import { reviewSubmission } from "@/lib/review";
import { saveSubmission } from "@/lib/submissions";
import type { SessionUser } from "@/lib/session";
import {
  CONTENT_TYPES,
  MAIN_THEMES,
  SUB_THEMES,
  type ContentType,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";
import { normalizePublishedUrl } from "@/lib/url";
import type { SubmissionInput } from "@/lib/validation/content";
import { submissionInputSchema, type Platform } from "@/lib/validation/content";

export const CONTENT_IMPORT_HEADERS = [
  "organisasi",
  "judul",
  "tautan",
  "platform",
  "jenis_konten",
  "tema_utama",
  "sub_tema",
  "narasi",
  "tanggal_konten",
  "tanggal_terbit",
  "lintang",
  "bujur",
  "lokasi",
] as const;

export const CONTENT_IMPORT_REQUIRED = [
  "organisasi",
  "tautan",
  "platform",
  "jenis_konten",
  "tema_utama",
  "sub_tema",
  "narasi",
  "tanggal_konten",
] as const;

export const CONTENT_IMPORT_MAX_BYTES = 1_000_000;
export const CONTENT_IMPORT_MAX_ROWS = 200;

const PLATFORM_ALIASES: Record<string, Platform> = {
  instagram: "INSTAGRAM",
  ig: "INSTAGRAM",
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  x: "X",
  twitter: "X",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
  yt: "YOUTUBE",
  website: "WEBSITE",
  web: "WEBSITE",
  situs: "WEBSITE",
  lainnya: "LAINNYA",
  other: "LAINNYA",
  lain: "LAINNYA",
};

const CONTENT_TYPE_ALIASES: Record<string, ContentType> = {
  video: "VIDEO",
  vidio: "VIDEO",
  infografis: "INFOGRAFIS",
  infographic: "INFOGRAFIS",
  gambar: "INFOGRAFIS",
  image: "INFOGRAFIS",
};

const MAIN_THEME_ALIASES: Record<string, MainTheme> = {
  edufast: "EDUFAST",
  "non-edufast": "NON_EDUFAST",
  "non edufast": "NON_EDUFAST",
  non_edufast: "NON_EDUFAST",
  nonedufast: "NON_EDUFAST",
  non: "NON_EDUFAST",
};

function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function compact(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSubTheme(value: string): SubTheme | null {
  const raw = value.trim();
  if (!raw) return null;
  const direct = raw.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  if ((SUB_THEMES as readonly string[]).includes(direct)) {
    return direct as SubTheme;
  }
  const compactRaw = compact(raw);
  for (const subTheme of SUB_THEMES) {
    if (compact(subTheme) === compactRaw) return subTheme;
  }
  const LABELS: Record<SubTheme, string> = {
    MOBILE_JKN: "Mobile JKN",
    TESTIMONI_PESERTA: "Testimoni Peserta",
    ALUR_BEROBAT: "Alur Berobat",
    EDUKATIF_PERSUASIF: "Edukatif Persuasif",
    KORPORAT: "Korporat",
    INFORMASI: "Informasi",
  };
  for (const subTheme of SUB_THEMES) {
    if (compact(LABELS[subTheme]) === compactRaw) return subTheme;
  }
  return null;
}

function normalizeDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const local = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(raw);
  if (local) {
    const [, day, month, year] = local;
    return `${year}-${month}-${day}`;
  }
  return null;
}

export const CONTENT_IMPORT_OPTIONAL_HEADERS = [
  "status",
  "tanggal_persetujuan",
] as const;

function csvDocument(rows: string[][]): string {
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((cell) =>
          /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(","),
    )
    .join("\r\n")}\r\n`;
}

export function contentTemplateCsv(): string {
  return csvDocument([
    [...CONTENT_IMPORT_HEADERS, ...CONTENT_IMPORT_OPTIONAL_HEADERS],
  ]);
}

export function contentExampleCsv(): string {
  const sample: string[][] = [
    [...CONTENT_IMPORT_HEADERS, ...CONTENT_IMPORT_OPTIONAL_HEADERS],
    [
      "FKTP-BDG-001",
      "Edukasi Mobile JKN untuk Peserta Baru",
      "https://www.instagram.com/p/contoh-konten-1",
      "instagram",
      "video",
      "edufast",
      "mobile jkn",
      "Video singkat yang menjelaskan langkah aktivasi dan penggunaan fitur utama Mobile JKN bagi peserta baru.",
      "2026-10-05",
      "2026-10-06",
      "",
      "",
      "",
      "submitted",
      "",
    ],
    [
      "Nama Pemda Contoh",
      "Infografis Alur Berobat di Fasilitas Kesehatan",
      "https://example.go.id/berita/alur-berobat",
      "website",
      "infografis",
      "non-edufast",
      "alur berobat",
      "Infografis ringkas berisi alur berobat mulai dari pendaftaran, pemeriksaan, hingga pengambilan obat di fasilitas kesehatan.",
      "2026-10-10",
      "",
      "",
      "",
      "",
      "submitted",
      "",
    ],
  ];
  return csvDocument(sample);
}

export type ContentImportRow = {
  rowNumber: number;
  status: "VALID" | "INVALID";
  organizationName: string | null;
  title: string | null;
  url: string | null;
  contentType: ContentType | null;
  mainTheme: MainTheme | null;
  subTheme: SubTheme | null;
  platform: Platform | null;
  dateCreated: string | null;
  approve: boolean;
  approvedAt: string | null;
  errors: string[];
};

export type ContentImportPreview = {
  filename: string;
  digest: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  approvedCount: number;
  rows: ContentImportRow[];
};

type ParsedRow = ContentImportRow & {
  input: SubmissionInput | null;
};

type OrganizationEntry = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  latitude: number;
  longitude: number;
};

type ContentDb = ReturnType<typeof getDb>;

type OrganizationIndex = {
  byCode: Map<string, OrganizationEntry>;
  byName: Map<string, OrganizationEntry>;
};

function buildOrganizationIndex(
  organizations: OrganizationEntry[],
): OrganizationIndex {
  const byCode = new Map<string, OrganizationEntry>();
  const byName = new Map<string, OrganizationEntry>();
  for (const organization of organizations) {
    if (organization.code) {
      byCode.set(compact(organization.code), organization);
    }
    byName.set(key(organization.name), organization);
  }
  return { byCode, byName };
}

function resolveOrganization(
  index: OrganizationIndex,
  value: string,
): OrganizationEntry | null {
  const raw = value.trim();
  if (!raw) return null;
  return index.byCode.get(compact(raw)) ?? index.byName.get(key(raw)) ?? null;
}

function digestOf(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function collectIssues(error: unknown): string[] {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    return (error as { issues: Array<{ message?: string }> }).issues
      .map((issue) => issue.message)
      .filter((message): message is string => Boolean(message));
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return [(error as { message: string }).message];
  }
  return ["Baris tidak dapat divalidasi."];
}

async function buildPreview(input: {
  filename: string;
  content: string;
  db?: ContentDb;
  allowApproved?: boolean;
}): Promise<{ preview: ContentImportPreview; parsed: ParsedRow[] }> {
  const db = input.db ?? getDb();
  if (Buffer.byteLength(input.content, "utf8") > CONTENT_IMPORT_MAX_BYTES) {
    throw errors.validation(
      "Berkas melebihi 1 MB. Pecah menjadi beberapa berkas.",
    );
  }

  const { headers, rows } = parseCsv(input.content);
  const missing = CONTENT_IMPORT_REQUIRED.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length > 0) {
    throw errors.validation(
      `Kolom wajib belum ada: ${missing.join(", ")}. Gunakan template terbaru.`,
    );
  }
  if (rows.length === 0) {
    throw errors.validation("Berkas tidak memuat baris data.");
  }
  if (rows.length > CONTENT_IMPORT_MAX_ROWS) {
    throw errors.validation(
      `Maksimal ${CONTENT_IMPORT_MAX_ROWS} baris per unggahan. Pecah berkas menjadi beberapa bagian.`,
    );
  }

  const column = (row: string[], name: string): string => {
    const index = headers.indexOf(name);
    return index === -1 ? "" : (row[index] ?? "").trim();
  };

  const organizations = await db
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      code: schema.stakeholders.faskesCodeNormalized,
      status: schema.stakeholders.status,
      latitude: schema.stakeholders.latitude,
      longitude: schema.stakeholders.longitude,
    })
    .from(schema.stakeholders);
  const index = buildOrganizationIndex(organizations);

  const digest = digestOf(input.content);
  const parsed: ParsedRow[] = [];
  const seenHashes = new Map<string, number>();

  for (const [position, row] of rows.entries()) {
    const rowNumber = position + 1;
    const errors: string[] = [];

    const organization = resolveOrganization(index, column(row, "organisasi"));
    if (!organization) {
      errors.push(
        "Organisasi tidak ditemukan. Isi kode Faskes atau nama organisasi persis.",
      );
    } else if (organization.status !== "ACTIVE") {
      errors.push("Organisasi tidak aktif dan tidak dapat menerima konten.");
    }

    const platformRaw = column(row, "platform");
    const platform = PLATFORM_ALIASES[key(platformRaw)] ?? null;
    if (!platform) errors.push("Platform tidak dikenal.");

    const typeRaw = column(row, "jenis_konten");
    const contentType =
      CONTENT_TYPE_ALIASES[compact(typeRaw)] ??
      ((CONTENT_TYPES as readonly string[]).includes(typeRaw.toUpperCase())
        ? (typeRaw.toUpperCase() as ContentType)
        : null);
    if (!contentType) errors.push("Jenis konten harus Video atau Infografis.");

    const themeRaw = column(row, "tema_utama");
    const mainTheme =
      MAIN_THEME_ALIASES[key(themeRaw)] ??
      ((MAIN_THEMES as readonly string[]).includes(themeRaw.toUpperCase())
        ? (themeRaw.toUpperCase() as MainTheme)
        : null);
    if (!mainTheme) errors.push("Tema utama harus EDUFAST atau Non-EDUFAST.");

    const subTheme = normalizeSubTheme(column(row, "sub_tema"));
    if (!subTheme) errors.push("Sub-tema tidak dikenal.");

    const dateCreated = normalizeDate(column(row, "tanggal_konten"));
    if (!dateCreated) {
      errors.push("Tanggal konten harus valid (YYYY-MM-DD).");
    }

    const publishedRaw = column(row, "tanggal_terbit");
    const publishedAt = publishedRaw ? normalizeDate(publishedRaw) : null;
    if (publishedRaw && !publishedAt) {
      errors.push("Tanggal terbit harus valid (YYYY-MM-DD).");
    }

    const statusRaw = key(column(row, "status"));
    const approve = ["disetujui", "approved", "setuju", "approve"].includes(
      statusRaw,
    );
    if (
      statusRaw &&
      !approve &&
      !["submitted", "diajukan", "baru"].includes(statusRaw)
    ) {
      errors.push("Status baris harus submitted atau disetujui.");
    }
    const approvalRaw = column(row, "tanggal_persetujuan");
    const approvalDate = approvalRaw ? normalizeDate(approvalRaw) : null;
    if (approvalRaw && !approvalDate) {
      errors.push("Tanggal persetujuan harus valid (YYYY-MM-DD).");
    }
    if (approve) {
      if (!input.allowApproved) {
        errors.push(
          "Hanya Master Admin yang boleh mengimpor baris berstatus disetujui.",
        );
      } else if (!approvalDate) {
        errors.push("Tanggal persetujuan wajib diisi untuk baris disetujui.");
      }
    }

    const url = column(row, "tautan");
    let urlHash: string | null = null;
    if (url) {
      try {
        urlHash = normalizePublishedUrl(url).normalizedUrlHash;
        const firstRow = seenHashes.get(urlHash);
        if (firstRow !== undefined) {
          errors.push(`Tautan sama dengan baris ${firstRow}.`);
        } else {
          seenHashes.set(urlHash, rowNumber);
        }
      } catch {
        errors.push("Tautan harus berupa URL https yang valid.");
      }
    }

    const latitudeRaw = column(row, "lintang");
    const longitudeRaw = column(row, "bujur");
    const latitude = latitudeRaw ? Number(latitudeRaw) : organization?.latitude;
    const longitude = longitudeRaw
      ? Number(longitudeRaw)
      : organization?.longitude;
    if (
      latitude === undefined ||
      longitude === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      errors.push("Koordinat lokasi tidak valid.");
    }
    const locationLabel =
      column(row, "lokasi") || organization?.name || "Lokasi konten";

    const title = column(row, "judul");
    const narrative = column(row, "narasi");

    let submissionInput: SubmissionInput | null = null;
    if (
      errors.length === 0 &&
      organization &&
      platform &&
      contentType &&
      mainTheme &&
      subTheme &&
      dateCreated &&
      latitude !== undefined &&
      longitude !== undefined
    ) {
      const candidate = {
        action: "SUBMIT" as const,
        idempotencyKey: `import-${digest.slice(0, 16)}-${rowNumber}`,
        stakeholderId: organization.id,
        publishedUrl: url,
        platform,
        contentType,
        mainTheme,
        subTheme,
        ...(title ? { title } : {}),
        narrative,
        dateCreated,
        publishedAt,
        location: {
          latitude,
          longitude,
          label: locationLabel,
          source: "manual_pin" as const,
        },
        duplicateAcknowledged: true,
        privacyAttested: true,
      };
      const validation = submissionInputSchema.safeParse(candidate);
      if (!validation.success) {
        errors.push(...collectIssues(validation.error));
      } else {
        submissionInput = validation.data;
      }
    }

    parsed.push({
      rowNumber,
      status: errors.length === 0 ? "VALID" : "INVALID",
      organizationName: organization?.name ?? null,
      title: title || null,
      url: url || null,
      contentType,
      mainTheme,
      subTheme,
      platform,
      dateCreated,
      approve,
      approvedAt: approvalDate,
      errors,
      input: submissionInput,
    });
  }

  const hashes = parsed
    .filter((row) => row.errors.length === 0)
    .map((row) => {
      const url = row.url;
      return url ? normalizePublishedUrl(url).normalizedUrlHash : null;
    })
    .filter((hash): hash is string => Boolean(hash));

  if (hashes.length > 0) {
    const existing = await db
      .select({
        hash: schema.contentSubmissions.normalizedUrlHash,
        referenceCode: schema.contentSubmissions.referenceCode,
      })
      .from(schema.contentSubmissions)
      .where(
        and(
          inArray(schema.contentSubmissions.normalizedUrlHash, hashes),
          ne(schema.contentSubmissions.status, "ARCHIVED"),
        ),
      )
      .limit(hashes.length);
    const existingByHash = new Map(
      existing.map((row) => [row.hash, row.referenceCode]),
    );
    for (const row of parsed) {
      if (!row.url) continue;
      const hash = normalizePublishedUrl(row.url).normalizedUrlHash;
      const referenceCode = existingByHash.get(hash);
      if (referenceCode) {
        row.errors.push(`Tautan sudah terdaftar pada konten ${referenceCode}.`);
        row.status = "INVALID";
        row.input = null;
      }
    }
  }

  const invalidRows = parsed.filter((row) => row.status === "INVALID");
  for (const row of invalidRows) row.input = null;
  const validRows = parsed.filter((row) => row.status === "VALID");

  for (const row of validRows) {
    if (!row.input || row.input.mainTheme !== "EDUFAST") continue;
    try {
      await assertEdufastSelection({
        dateCreated: row.input.dateCreated,
        mainTheme: row.input.mainTheme,
        subTheme: row.input.subTheme ?? "",
      });
    } catch (error) {
      row.errors.push(...collectIssues(error));
      row.status = "INVALID";
      row.input = null;
    }
  }

  const rowsOut: ContentImportRow[] = parsed.map((row) => ({
    rowNumber: row.rowNumber,
    status: row.status,
    organizationName: row.organizationName,
    title: row.title,
    url: row.url,
    contentType: row.contentType,
    mainTheme: row.mainTheme,
    subTheme: row.subTheme,
    platform: row.platform,
    dateCreated: row.dateCreated,
    approve: row.approve,
    approvedAt: row.approvedAt,
    errors: row.errors,
  }));

  return {
    preview: {
      filename: input.filename,
      digest,
      rowCount: rowsOut.length,
      validCount: rowsOut.filter((row) => row.status === "VALID").length,
      errorCount: rowsOut.filter((row) => row.status === "INVALID").length,
      approvedCount: rowsOut.filter(
        (row) => row.status === "VALID" && row.approve,
      ).length,
      rows: rowsOut,
    },
    parsed,
  };
}

export async function previewContentImport(input: {
  filename: string;
  content: string;
  actorRole?: AppRole;
  db?: ContentDb;
}): Promise<ContentImportPreview> {
  const { preview } = await buildPreview({
    filename: input.filename,
    content: input.content,
    allowApproved: input.actorRole === "MASTER_ADMIN",
    db: input.db,
  });
  return preview;
}

export type ContentImportCommitRow = {
  rowNumber: number;
  status: "CREATED" | "APPROVED" | "FAILED";
  referenceCode: string | null;
  submissionId: string | null;
  organizationName: string | null;
  error: string | null;
};

export type ContentImportCommitResult = {
  runId: string;
  filename: string;
  digest: string;
  created: number;
  approved: number;
  failed: number;
  rows: ContentImportCommitRow[];
};

export async function commitContentImport(input: {
  filename: string;
  content: string;
  digest: string;
  actor: SessionUser;
  requestId?: string;
  db?: ContentDb;
}): Promise<ContentImportCommitResult> {
  const db = input.db ?? getDb();
  const { preview, parsed } = await buildPreview({
    filename: input.filename,
    content: input.content,
    allowApproved: input.actor.role === "MASTER_ADMIN",
    db,
  });
  if (preview.digest !== input.digest) {
    throw errors.conflict(
      "Berkas berubah sejak pratinjau. Jalankan pratinjau ulang sebelum impor.",
    );
  }
  if (preview.errorCount > 0) {
    throw errors.validation(
      "Masih ada baris bermasalah. Perbaiki berkas lalu jalankan pratinjau ulang.",
    );
  }

  const idempotencyKey = `content-import:${input.actor.id}:${preview.digest}`;
  const [existingRun] = await db
    .select({ id: schema.contentImportRuns.id })
    .from(schema.contentImportRuns)
    .where(eq(schema.contentImportRuns.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existingRun) {
    throw errors.conflict(
      "Berkas ini sudah pernah diimpor. Unduh laporan hasil impor sebelumnya.",
    );
  }

  const [run] = await db
    .insert(schema.contentImportRuns)
    .values({
      actorId: input.actor.id,
      filename: input.filename,
      digest: preview.digest,
      idempotencyKey,
      status: "VALIDATED",
      rowCount: parsed.length,
    })
    .returning({ id: schema.contentImportRuns.id });
  if (!run) throw errors.server("Riwayat impor konten tidak dapat disimpan.");

  const rows: ContentImportCommitRow[] = [];
  for (const row of parsed) {
    if (!row.input) {
      rows.push({
        rowNumber: row.rowNumber,
        status: "FAILED",
        referenceCode: null,
        submissionId: null,
        organizationName: row.organizationName,
        error: "Baris tidak valid.",
      });
      continue;
    }
    try {
      const saved = await saveSubmission(
        input.actor,
        row.input,
        input.requestId,
      );
      let status: ContentImportCommitRow["status"] = "CREATED";

      if (row.approve) {
        await reviewSubmission(
          input.actor,
          {
            submissionId: saved.id,
            action: "APPROVE",
            expectedVersion: saved.version,
            checklist: {
              relevansiTema: true,
              akurasiKonten: true,
              kelengkapanTautan: true,
              etikaDanPrivasi: true,
            },
            notes: `IMPORT_APPROVED:${preview.digest.slice(0, 12)}`,
          },
          input.requestId,
        );
        if (row.approvedAt) {
          // Tanggal persetujuan berasal dari berkas resmi Master Admin.
          await db
            .update(schema.contentSubmissions)
            .set({ approvedAt: new Date(`${row.approvedAt}T00:00:00+07:00`) })
            .where(eq(schema.contentSubmissions.id, saved.id));
        }
        status = "APPROVED";
      }

      rows.push({
        rowNumber: row.rowNumber,
        status,
        referenceCode: saved.referenceCode,
        submissionId: saved.id,
        organizationName: row.organizationName,
        error: null,
      });
    } catch (error) {
      rows.push({
        rowNumber: row.rowNumber,
        status: "FAILED",
        referenceCode: null,
        submissionId: null,
        organizationName: row.organizationName,
        error: collectIssues(error)[0] ?? "Baris gagal diimpor.",
      });
    }
  }

  const created = rows.filter((row) => row.status === "CREATED").length;
  const approved = rows.filter((row) => row.status === "APPROVED").length;
  const failed = rows.filter((row) => row.status === "FAILED").length;

  await db.insert(schema.contentImportRows).values(
    rows.map((row) => ({
      runId: run.id,
      rowNumber: row.rowNumber,
      status: row.status,
      referenceCode: row.referenceCode,
      submissionId: row.submissionId,
      organizationName: row.organizationName,
      errors: row.error ? [row.error] : null,
    })),
  );

  await db
    .update(schema.contentImportRuns)
    .set({
      status: "COMMITTED",
      committedAt: new Date(),
      createdCount: created,
      approvedCount: approved,
      failedCount: failed,
      stats: { created, approved, failed, total: rows.length },
    })
    .where(eq(schema.contentImportRuns.id, run.id));

  return {
    runId: run.id,
    filename: input.filename,
    digest: preview.digest,
    created,
    approved,
    failed,
    rows,
  };
}

export function contentImportResultsCsv(
  rows: ContentImportCommitRow[],
): string {
  return toCsv(
    ["baris", "status", "kode_referensi", "organisasi", "kesalahan"],
    rows.map((row) => [
      row.rowNumber,
      row.status,
      row.referenceCode ?? "",
      row.organizationName ?? "",
      row.error ?? "",
    ]),
  );
}
