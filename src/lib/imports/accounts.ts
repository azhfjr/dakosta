import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { createAccount } from "@/lib/accounts";
import { assertDemoCannotManageAccounts } from "@/lib/authz/demo-guard";
import { toCsv } from "@/lib/csv";
import { AppError, errors } from "@/lib/errors";

export const ACCOUNT_IMPORT_HEADERS = [
  "nama",
  "email",
  "peran",
  "wilayah",
  "cabang",
  "organisasi",
  "jabatan",
] as const;

export const IMPORT_MAX_BYTES = 1_000_000;
export const IMPORT_MAX_ROWS = 1000;

const ROLE_CODES: Record<
  string,
  "MASTER_ADMIN" | "REGIONAL_ADMIN" | "BRANCH_ADMIN" | "STAKEHOLDER"
> = {
  master: "MASTER_ADMIN",
  "master admin": "MASTER_ADMIN",
  master_admin: "MASTER_ADMIN",
  wilayah: "REGIONAL_ADMIN",
  "admin wilayah": "REGIONAL_ADMIN",
  "regional admin": "REGIONAL_ADMIN",
  regional_admin: "REGIONAL_ADMIN",
  cabang: "BRANCH_ADMIN",
  "admin cabang": "BRANCH_ADMIN",
  "branch admin": "BRANCH_ADMIN",
  branch_admin: "BRANCH_ADMIN",
  stakeholder: "STAKEHOLDER",
  organisasi: "STAKEHOLDER",
};

export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  const [headerRow, ...body] = nonEmpty;
  if (!headerRow) throw errors.validation("Berkas CSV kosong.");
  return {
    headers: headerRow.map((header) => header.trim().toLowerCase()),
    rows: body,
  };
}

export function templateCsv(): string {
  const sample = [
    ["nama", "email", "peran", "wilayah", "cabang", "organisasi", "jabatan"],
    [
      "Contoh Admin Cabang",
      "admin.cabang@instansi.go.id",
      "cabang",
      "",
      "CBG-BDG-KOTA",
      "",
      "Admin Cabang Bandung Kota",
    ],
    [
      "Contoh Stakeholder",
      "humas.fktp@instansi.go.id",
      "stakeholder",
      "",
      "",
      "FKTP-BDG-001",
      "Humas FKTP",
    ],
    [
      "Contoh Admin Wilayah",
      "admin.wilayah@instansi.go.id",
      "wilayah",
      "REG-JABAR",
      "",
      "",
      "Admin Regional",
    ],
  ];
  return `\uFEFF${sample
    .map((row) =>
      row
        .map((cell) =>
          /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(","),
    )
    .join("\r\n")}\r\n`;
}

export type ImportRowResult = {
  rowNumber: number;
  status: "VALID" | "INVALID" | "CREATED" | "SKIPPED" | "FAILED";
  normalized: Record<string, string> | null;
  errors: string[] | null;
  userId: string | null;
};

export type ImportPreview = {
  importId: string;
  filename: string;
  digest: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  rows: ImportRowResult[];
  stats: Record<string, number>;
};

type ScopeIndex = {
  regionsByCode: Map<string, { id: string; name: string }>;
  regionsByName: Map<string, { id: string; name: string }>;
  branchesByCode: Map<string, { id: string; name: string; regionId: string }>;
  organizationsByCode: Map<
    string,
    { id: string; name: string; branchId: string | null }
  >;
  organizationsByName: Map<
    string,
    { id: string; name: string; branchId: string | null }
  >;
};

async function loadScopeIndex(): Promise<ScopeIndex> {
  const db = getDb();
  const [regions, branches, organizations] = await Promise.all([
    db
      .select({
        id: schema.regionalOffices.id,
        name: schema.regionalOffices.name,
        code: schema.regionalOffices.code,
      })
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.status, "ACTIVE")),
    db
      .select({
        id: schema.branchOffices.id,
        name: schema.branchOffices.name,
        code: schema.branchOffices.code,
        regionId: schema.branchOffices.regionalOfficeId,
      })
      .from(schema.branchOffices)
      .where(eq(schema.branchOffices.status, "ACTIVE")),
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        faskesCode: schema.stakeholders.faskesCode,
        branchId: schema.stakeholders.branchOfficeId,
      })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.status, "ACTIVE")),
  ]);

  const organizationsByCode = new Map<
    string,
    { id: string; name: string; branchId: string | null }
  >();
  const organizationsByName = new Map<
    string,
    { id: string; name: string; branchId: string | null }
  >();
  for (const organization of organizations) {
    const entry = {
      id: organization.id,
      name: organization.name,
      branchId: organization.branchId,
    };
    organizationsByName.set(organization.name.toLowerCase(), entry);
    if (organization.faskesCode) {
      organizationsByCode.set(organization.faskesCode.toUpperCase(), entry);
    }
  }

  return {
    regionsByCode: new Map(
      regions.map((region) => [
        region.code.toUpperCase(),
        { id: region.id, name: region.name },
      ]),
    ),
    regionsByName: new Map(
      regions.map((region) => [
        region.name.toLowerCase(),
        { id: region.id, name: region.name },
      ]),
    ),
    branchesByCode: new Map(
      branches.map((branch) => [
        branch.code.toUpperCase(),
        { id: branch.id, name: branch.name, regionId: branch.regionId },
      ]),
    ),
    organizationsByCode,
    organizationsByName,
  };
}

const rowSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(80, "Nama maksimal 80 karakter."),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  peran: z.string().trim().min(1, "Peran wajib diisi."),
  wilayah: z.string().trim().optional().default(""),
  cabang: z.string().trim().optional().default(""),
  organisasi: z.string().trim().optional().default(""),
  jabatan: z.string().trim().max(80).optional().default(""),
});

function normalizeRow(
  raw: Record<string, string>,
  index: ScopeIndex,
  seenEmails: Set<string>,
): { normalized: Record<string, string>; errors: string[] } {
  const errors: string[] = [];
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { normalized: {}, errors };
  }

  const value = parsed.data;
  const role = ROLE_CODES[value.peran.toLowerCase()];
  if (!role) {
    errors.push(
      "peran: Gunakan master admin, admin wilayah, admin cabang, atau stakeholder.",
    );
    return { normalized: {}, errors };
  }
  if (role === "MASTER_ADMIN") {
    errors.push("peran: Master Admin tidak boleh dibuat lewat impor.");
    return { normalized: {}, errors };
  }
  if (seenEmails.has(value.email)) {
    errors.push("email: Email duplikat di dalam berkas.");
  }
  seenEmails.add(value.email);

  const normalized: Record<string, string> = {
    name: value.nama,
    email: value.email,
    role,
    displayTitle: value.jabatan,
  };

  if (role === "REGIONAL_ADMIN") {
    const region =
      index.regionsByCode.get(value.wilayah.toUpperCase()) ??
      index.regionsByName.get(value.wilayah.toLowerCase());
    if (!region) errors.push("wilayah: Kode/nama wilayah tidak ditemukan.");
    else normalized.regionalOfficeId = region.id;
    if (value.cabang || value.organisasi) {
      errors.push(
        "wilayah: Admin wilayah tidak boleh memiliki cabang/organisasi.",
      );
    }
  } else if (role === "BRANCH_ADMIN") {
    const branch = index.branchesByCode.get(value.cabang.toUpperCase());
    if (!branch) errors.push("cabang: Kode cabang tidak ditemukan.");
    else normalized.branchOfficeId = branch.id;
    if (value.organisasi) {
      errors.push("cabang: Admin cabang tidak boleh memiliki organisasi.");
    }
  } else {
    const organization =
      index.organizationsByCode.get(value.organisasi.toUpperCase()) ??
      index.organizationsByName.get(value.organisasi.toLowerCase());
    if (!organization)
      errors.push("organisasi: Kode Faskes/nama organisasi tidak ditemukan.");
    else normalized.organizationId = organization.id;
  }

  return { normalized, errors };
}

export async function previewImport(input: {
  filename: string;
  content: string;
  actorId: string;
  idempotencyKey?: string;
}): Promise<ImportPreview> {
  if (Buffer.byteLength(input.content, "utf8") > IMPORT_MAX_BYTES) {
    throw errors.validation(
      "Berkas melebihi 1 MB. Pecah menjadi beberapa berkas.",
    );
  }

  const { headers, rows } = parseCsv(input.content);
  const missing = ACCOUNT_IMPORT_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length > 0) {
    throw errors.validation(
      `Kolom wajib tidak ditemukan: ${missing.join(", ")}.`,
    );
  }
  if (rows.length === 0)
    throw errors.validation("Berkas tidak memiliki baris data.");
  if (rows.length > IMPORT_MAX_ROWS) {
    throw errors.validation(`Maksimal ${IMPORT_MAX_ROWS} baris per impor.`);
  }

  const index = await loadScopeIndex();
  const seenEmails = new Set<string>();
  const results: ImportRowResult[] = rows.map((row, position) => {
    const raw: Record<string, string> = {};
    for (const header of ACCOUNT_IMPORT_HEADERS) {
      raw[header] = row[headers.indexOf(header)] ?? "";
    }
    const { normalized, errors } = normalizeRow(raw, index, seenEmails);
    return {
      rowNumber: position + 1,
      status: errors.length > 0 ? "INVALID" : "VALID",
      normalized: errors.length > 0 ? null : normalized,
      errors: errors.length > 0 ? errors : null,
      userId: null,
    };
  });

  const digest = createHash("sha256").update(input.content).digest("hex");
  const idempotencyKey =
    input.idempotencyKey ?? `import:${input.actorId}:${digest}`;
  const validCount = results.filter(
    (result) => result.status === "VALID",
  ).length;
  const errorCount = results.length - validCount;

  const db = getDb();
  const [existing] = await db
    .select({ id: schema.accountImports.id })
    .from(schema.accountImports)
    .where(eq(schema.accountImports.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing) {
    await db
      .delete(schema.accountImportRows)
      .where(eq(schema.accountImportRows.importId, existing.id));
    await db
      .update(schema.accountImports)
      .set({
        actorId: input.actorId,
        filename: input.filename,
        digest,
        status: "VALIDATED",
        previewStats: {
          valid: validCount,
          invalid: errorCount,
          total: results.length,
        },
        rowCount: results.length,
        errorCount,
        committedAt: null,
      })
      .where(eq(schema.accountImports.id, existing.id));
    await db.insert(schema.accountImportRows).values(
      results.map((result) => ({
        importId: existing.id,
        rowNumber: result.rowNumber,
        status: result.status,
        normalized: result.normalized,
        errors: result.errors,
      })),
    );
    return {
      importId: existing.id,
      filename: input.filename,
      digest,
      rowCount: results.length,
      validCount,
      errorCount,
      rows: results,
      stats: { valid: validCount, invalid: errorCount, total: results.length },
    };
  }

  const [created] = await db
    .insert(schema.accountImports)
    .values({
      actorId: input.actorId,
      filename: input.filename,
      digest,
      mode: "create_only",
      status: "VALIDATED",
      idempotencyKey,
      previewStats: {
        valid: validCount,
        invalid: errorCount,
        total: results.length,
      },
      rowCount: results.length,
      errorCount,
    })
    .returning({ id: schema.accountImports.id });

  if (!created) throw errors.server("Pratinjau impor tidak dapat disimpan.");

  await db.insert(schema.accountImportRows).values(
    results.map((result) => ({
      importId: created.id,
      rowNumber: result.rowNumber,
      status: result.status,
      normalized: result.normalized,
      errors: result.errors,
    })),
  );

  return {
    importId: created.id,
    filename: input.filename,
    digest,
    rowCount: results.length,
    validCount,
    errorCount,
    rows: results,
    stats: { valid: validCount, invalid: errorCount, total: results.length },
  };
}

export type ImportCommitResult = {
  importId: string;
  created: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
  credentials: Array<{
    rowNumber: number;
    name: string;
    email: string;
    tempPassword: string;
  }>;
};

export async function commitImport(input: {
  importId: string;
  actorId: string;
}): Promise<ImportCommitResult> {
  await assertDemoCannotManageAccounts();
  const db = getDb();
  const [record] = await db
    .select()
    .from(schema.accountImports)
    .where(eq(schema.accountImports.id, input.importId))
    .limit(1);
  if (!record) throw errors.notFound("Impor tidak ditemukan.");
  if (record.status === "COMMITTED") {
    throw errors.conflict("Impor ini sudah dijalankan.");
  }

  const rows = await db
    .select()
    .from(schema.accountImportRows)
    .where(eq(schema.accountImportRows.importId, input.importId))
    .orderBy(schema.accountImportRows.rowNumber);

  const results: ImportRowResult[] = [];
  const credentials: ImportCommitResult["credentials"] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (row.status !== "VALID" || !row.normalized) {
      results.push({
        rowNumber: row.rowNumber,
        status: row.status as ImportRowResult["status"],
        normalized: (row.normalized as Record<string, string> | null) ?? null,
        errors: row.errors,
        userId: row.userId,
      });
      if (row.status === "INVALID") failed += 1;
      continue;
    }

    const normalized = row.normalized as Record<string, string>;
    try {
      const account = await createAccount({
        name: normalized.name!,
        email: normalized.email!,
        role: normalized.role as
          "REGIONAL_ADMIN" | "BRANCH_ADMIN" | "STAKEHOLDER",
        regionalOfficeId: normalized.regionalOfficeId ?? null,
        branchOfficeId: normalized.branchOfficeId ?? null,
        organizationId: normalized.organizationId ?? null,
        displayTitle: normalized.displayTitle || undefined,
      });
      created += 1;
      credentials.push({
        rowNumber: row.rowNumber,
        name: normalized.name!,
        email: normalized.email!,
        tempPassword: account.tempPassword,
      });
      await db
        .update(schema.accountImportRows)
        .set({ status: "CREATED", userId: account.userId })
        .where(
          and(
            eq(schema.accountImportRows.importId, input.importId),
            eq(schema.accountImportRows.rowNumber, row.rowNumber),
          ),
        );
      results.push({
        rowNumber: row.rowNumber,
        status: "CREATED",
        normalized,
        errors: null,
        userId: account.userId,
      });
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : "Akun tidak dapat dibuat. Periksa email duplikat.";
      await db
        .update(schema.accountImportRows)
        .set({ status: "SKIPPED", errors: [message] })
        .where(
          and(
            eq(schema.accountImportRows.importId, input.importId),
            eq(schema.accountImportRows.rowNumber, row.rowNumber),
          ),
        );
      skipped += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "SKIPPED",
        normalized,
        errors: [message],
        userId: null,
      });
    }
  }

  await db
    .update(schema.accountImports)
    .set({
      status: "COMMITTED",
      committedAt: new Date(),
      previewStats: { created, skipped, failed, total: results.length },
    })
    .where(eq(schema.accountImports.id, input.importId));

  return {
    importId: input.importId,
    created,
    skipped,
    failed,
    rows: results,
    credentials,
  };
}

export type ImportHistoryRow = {
  id: string;
  filename: string;
  status: string;
  rowCount: number;
  errorCount: number;
  createdAt: Date;
  committedAt: Date | null;
};

export async function listImports(limit = 20): Promise<ImportHistoryRow[]> {
  return getDb()
    .select({
      id: schema.accountImports.id,
      filename: schema.accountImports.filename,
      status: schema.accountImports.status,
      rowCount: schema.accountImports.rowCount,
      errorCount: schema.accountImports.errorCount,
      createdAt: schema.accountImports.createdAt,
      committedAt: schema.accountImports.committedAt,
    })
    .from(schema.accountImports)
    .orderBy(desc(schema.accountImports.createdAt))
    .limit(limit);
}

export function importResultsCsv(rows: ImportRowResult[]): string {
  return toCsv(
    ["baris", "status", "nama", "email", "peran", "kesalahan"],
    rows.map((row) => [
      row.rowNumber,
      row.status,
      row.normalized?.name ?? "",
      row.normalized?.email ?? "",
      row.normalized?.role ?? "",
      (row.errors ?? []).join("; "),
    ]),
  );
}
