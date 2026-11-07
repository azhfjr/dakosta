import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { createAccount, updateAccount } from "@/lib/accounts";
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

export const IMPORT_CONFLICT_POLICIES = ["skip", "update", "upsert"] as const;
export type ImportConflictPolicy = (typeof IMPORT_CONFLICT_POLICIES)[number];

export function parseConflictPolicy(value: unknown): ImportConflictPolicy {
  return IMPORT_CONFLICT_POLICIES.includes(value as ImportConflictPolicy)
    ? (value as ImportConflictPolicy)
    : "skip";
}

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

function detectDelimiter(input: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === "\n" || char === "\r") break;
    if (char === ",") commas += 1;
    if (char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const input = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(input);
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
    } else if (char === delimiter) {
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

export function templateCsv(): string {
  return csvDocument([[...ACCOUNT_IMPORT_HEADERS]]);
}

export function exampleAccountCsv(): string {
  return csvDocument([
    [...ACCOUNT_IMPORT_HEADERS],
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
  ]);
}

export type ImportRowResult = {
  rowNumber: number;
  status:
    | "VALID"
    | "INVALID"
    | "CONFLICT"
    | "CREATED"
    | "UPDATED"
    | "SKIPPED"
    | "FAILED";
  normalized: Record<string, string> | null;
  errors: string[] | null;
  userId: string | null;
};

export type ImportPreview = {
  importId: string;
  filename: string;
  digest: string;
  policy: ImportConflictPolicy;
  rowCount: number;
  validCount: number;
  conflictCount: number;
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

type ImportDb = ReturnType<typeof getDb>;

async function loadScopeIndex(db: ImportDb): Promise<ScopeIndex> {
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
  policy?: ImportConflictPolicy;
  db?: ImportDb;
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

  const db = input.db ?? getDb();
  const index = await loadScopeIndex(db);
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

  const policy = parseConflictPolicy(input.policy);
  const candidates = results
    .map((result) => result.normalized?.email)
    .filter((email): email is string => Boolean(email));
  if (candidates.length > 0) {
    const existing = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(inArray(sql`lower(${schema.user.email})`, candidates));
    const existingByEmail = new Map(
      existing.map((row) => [row.email.toLowerCase(), row.id]),
    );
    for (const result of results) {
      const email = result.normalized?.email;
      if (result.status !== "VALID" || !email) continue;
      const existingId = existingByEmail.get(email);
      if (!existingId) continue;
      result.userId = existingId;
      if (policy === "skip") {
        result.status = "SKIPPED";
        result.errors = [
          "Email sudah terdaftar; baris dilewati sesuai kebijakan.",
        ];
      } else {
        result.status = "CONFLICT";
        result.errors = [
          policy === "update"
            ? "Email sudah terdaftar; data akun akan diperbarui."
            : "Email sudah terdaftar; akun akan diperbarui (upsert).",
        ];
      }
    }
  }

  const digest = createHash("sha256").update(input.content).digest("hex");
  const idempotencyKey =
    input.idempotencyKey ?? `import:${input.actorId}:${digest}`;
  const validCount = results.filter(
    (result) => result.status === "VALID",
  ).length;
  const conflictCount = results.filter(
    (result) => result.status === "CONFLICT",
  ).length;
  const skippedCount = results.filter(
    (result) => result.status === "SKIPPED",
  ).length;
  const errorCount = results.filter(
    (result) => result.status === "INVALID",
  ).length;
  const stats = {
    valid: validCount,
    conflicts: conflictCount,
    skipped: skippedCount,
    invalid: errorCount,
    total: results.length,
  };

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
        mode: policy,
        status: "VALIDATED",
        previewStats: stats,
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
      policy,
      rowCount: results.length,
      validCount,
      conflictCount,
      errorCount,
      rows: results,
      stats,
    };
  }

  const [created] = await db
    .insert(schema.accountImports)
    .values({
      actorId: input.actorId,
      filename: input.filename,
      digest,
      mode: policy,
      status: "VALIDATED",
      idempotencyKey,
      previewStats: stats,
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
    policy,
    rowCount: results.length,
    validCount,
    conflictCount,
    errorCount,
    rows: results,
    stats,
  };
}

export type ImportCommitResult = {
  importId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
  credentials: Array<{
    rowNumber: number;
    name: string;
    email: string;
    activationUrl: string;
  }>;
};

type ImportRole = "REGIONAL_ADMIN" | "BRANCH_ADMIN" | "STAKEHOLDER";

async function setRowOutcome(
  importId: string,
  rowNumber: number,
  patch: {
    status: ImportRowResult["status"];
    errors: string[] | null;
    userId: string | null;
  },
): Promise<void> {
  await getDb()
    .update(schema.accountImportRows)
    .set({
      status: patch.status,
      errors: patch.errors,
      userId: patch.userId,
    })
    .where(
      and(
        eq(schema.accountImportRows.importId, importId),
        eq(schema.accountImportRows.rowNumber, rowNumber),
      ),
    );
}

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

  const policy = parseConflictPolicy(record.mode);
  const normalizedRows = rows.map(
    (row) => (row.normalized as Record<string, string> | null) ?? null,
  );
  const emails = normalizedRows
    .map((normalized) => normalized?.email)
    .filter((email): email is string => Boolean(email));

  // Emails can appear or disappear between preview and commit, so the
  // conflict decision is re-checked against the live table.
  const liveExisting =
    emails.length > 0
      ? await db
          .select({ id: schema.user.id, email: schema.user.email })
          .from(schema.user)
          .where(inArray(sql`lower(${schema.user.email})`, emails))
      : [];
  const existingByEmail = new Map(
    liveExisting.map((row) => [row.email.toLowerCase(), row.id]),
  );

  const results: ImportRowResult[] = [];
  const credentials: ImportCommitResult["credentials"] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, row] of rows.entries()) {
    const normalized = normalizedRows[index];
    const persistedStatus = row.status as ImportRowResult["status"];

    if (persistedStatus === "INVALID" || !normalized) {
      failed += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "INVALID",
        normalized,
        errors: row.errors ?? ["Baris tidak valid."],
        userId: null,
      });
      continue;
    }

    if (persistedStatus === "SKIPPED" && policy === "skip") {
      skipped += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "SKIPPED",
        normalized,
        errors: row.errors,
        userId: row.userId,
      });
      continue;
    }

    const email = normalized.email!;
    const role = normalized.role as ImportRole;
    const existingId =
      existingByEmail.get(email.toLowerCase()) ?? row.userId ?? null;

    if (existingId) {
      if (policy === "skip") {
        const message = "Email sudah terdaftar; baris dilewati.";
        await setRowOutcome(input.importId, row.rowNumber, {
          status: "SKIPPED",
          errors: [message],
          userId: existingId,
        });
        skipped += 1;
        results.push({
          rowNumber: row.rowNumber,
          status: "SKIPPED",
          normalized,
          errors: [message],
          userId: existingId,
        });
        continue;
      }

      try {
        await updateAccount(input.actorId, existingId, {
          name: normalized.name!,
          role,
          regionalOfficeId: normalized.regionalOfficeId ?? null,
          branchOfficeId: normalized.branchOfficeId ?? null,
          organizationId: normalized.organizationId ?? null,
          displayTitle: normalized.displayTitle || null,
        });
        await setRowOutcome(input.importId, row.rowNumber, {
          status: "UPDATED",
          errors: null,
          userId: existingId,
        });
        updated += 1;
        results.push({
          rowNumber: row.rowNumber,
          status: "UPDATED",
          normalized,
          errors: null,
          userId: existingId,
        });
      } catch (error) {
        const message =
          error instanceof AppError
            ? error.message
            : "Akun tidak dapat diperbarui.";
        await setRowOutcome(input.importId, row.rowNumber, {
          status: "FAILED",
          errors: [message],
          userId: existingId,
        });
        failed += 1;
        results.push({
          rowNumber: row.rowNumber,
          status: "FAILED",
          normalized,
          errors: [message],
          userId: existingId,
        });
      }
      continue;
    }

    try {
      const account = await createAccount(
        {
          name: normalized.name!,
          email,
          role,
          regionalOfficeId: normalized.regionalOfficeId ?? null,
          branchOfficeId: normalized.branchOfficeId ?? null,
          organizationId: normalized.organizationId ?? null,
          displayTitle: normalized.displayTitle || undefined,
        },
        { createdBy: input.actorId },
      );
      created += 1;
      credentials.push({
        rowNumber: row.rowNumber,
        name: normalized.name!,
        email: normalized.email!,
        activationUrl: account.activationUrl,
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
          : "Akun tidak dapat dibuat karena kesalahan server.";
      await db
        .update(schema.accountImportRows)
        .set({ status: "FAILED", errors: [message] })
        .where(
          and(
            eq(schema.accountImportRows.importId, input.importId),
            eq(schema.accountImportRows.rowNumber, row.rowNumber),
          ),
        );
      failed += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "FAILED",
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
      previewStats: {
        created,
        updated,
        skipped,
        failed,
        total: results.length,
      },
    })
    .where(eq(schema.accountImports.id, input.importId));

  return {
    importId: input.importId,
    created,
    updated,
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
