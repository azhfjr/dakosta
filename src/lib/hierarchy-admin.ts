import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { AppError, errors } from "@/lib/errors";

const codeSchema = z
  .string()
  .trim()
  .min(2, "Kode minimal 2 karakter.")
  .max(24, "Kode maksimal 24 karakter.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Kode hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
  );

const nameSchema = z
  .string()
  .trim()
  .min(3, "Nama minimal 3 karakter.")
  .max(120, "Nama maksimal 120 karakter.");

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const regionSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  status: statusSchema.default("ACTIVE"),
});

export const createRegionInputSchema = regionSchema;
export const updateRegionInputSchema = regionSchema;
export type RegionInput = z.infer<typeof regionSchema>;

const branchSchema = z.object({
  regionalOfficeId: z.string().uuid("Wilayah tidak valid."),
  code: codeSchema,
  name: nameSchema,
  status: statusSchema.default("ACTIVE"),
});

export const createBranchInputSchema = branchSchema;
export const updateBranchInputSchema = branchSchema;
export type BranchInput = z.infer<typeof branchSchema>;

const organizationSchema = z
  .object({
    name: nameSchema,
    branchOfficeId: z.string().uuid("Cabang tidak valid."),
    organizationType: z.enum(["FASKES", "PEMDA", "OTHER"]),
    faskesClass: z.enum(["FKTP", "FKRTL"]).nullish(),
    faskesCode: z.string().trim().max(24).nullish(),
    serviceArea: z
      .string()
      .trim()
      .min(2, "Wilayah layanan minimal 2 karakter.")
      .max(120),
    addressLabel: z.string().trim().max(160).nullish(),
    latitude: z
      .number()
      .min(-90, "Latitude harus antara -90 dan 90.")
      .max(90, "Latitude harus antara -90 dan 90."),
    longitude: z
      .number()
      .min(-180, "Longitude harus antara -180 dan 180.")
      .max(180, "Longitude harus antara -180 dan 180."),
    status: statusSchema.default("ACTIVE"),
  })
  .superRefine((value, ctx) => {
    if (value.organizationType === "FASKES") {
      if (!value.faskesClass) {
        ctx.addIssue({
          code: "custom",
          path: ["faskesClass"],
          message: "Faskes wajib memiliki kelas FKTP atau FKRTL.",
        });
      }
      if (!value.faskesCode || value.faskesCode.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["faskesCode"],
          message: "Kode Faskes wajib diisi minimal 2 karakter.",
        });
      }
      return;
    }
    if (value.faskesClass || value.faskesCode) {
      ctx.addIssue({
        code: "custom",
        path: ["faskesClass"],
        message: "PEMDA dan organisasi lain tidak memakai kelas atau kode Faskes.",
      });
    }
  });

export const createOrganizationInputSchema = organizationSchema;
export const updateOrganizationInputSchema = organizationSchema;
export type OrganizationInput = z.infer<typeof organizationSchema>;

const CATEGORY_BY_TYPE = {
  FASKES: "FASKES",
  PEMDA: "INSTANSI",
  OTHER: "ORGANISASI",
} as const;

export function normalizeFaskesCode(code: string): string {
  return code.trim().toUpperCase();
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "23505";
}

async function assertRegionExists(regionId: string): Promise<void> {
  const [region] = await getDb()
    .select({ id: schema.regionalOffices.id })
    .from(schema.regionalOffices)
    .where(eq(schema.regionalOffices.id, regionId))
    .limit(1);
  if (!region) throw errors.validation("Wilayah tidak ditemukan.");
}

async function assertBranchExists(branchId: string): Promise<{ regionId: string }> {
  const [branch] = await getDb()
    .select({ id: schema.branchOffices.id, regionId: schema.branchOffices.regionalOfficeId })
    .from(schema.branchOffices)
    .where(
      and(
        eq(schema.branchOffices.id, branchId),
        eq(schema.branchOffices.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!branch) throw errors.validation("Cabang tidak ditemukan atau tidak aktif.");
  return { regionId: branch.regionId };
}

async function assertFaskesCodeAvailable(
  normalized: string,
  excludeOrganizationId?: string,
): Promise<void> {
  const conditions = [
    eq(schema.stakeholders.organizationType, "FASKES"),
    eq(schema.stakeholders.faskesCodeNormalized, normalized),
  ];
  if (excludeOrganizationId) {
    conditions.push(ne(schema.stakeholders.id, excludeOrganizationId));
  }
  const [existing] = await getDb()
    .select({ id: schema.stakeholders.id })
    .from(schema.stakeholders)
    .where(and(...conditions))
    .limit(1);
  if (existing) {
    throw errors.conflict("Kode Faskes sudah dipakai organisasi lain.");
  }
}

export async function createRegion(input: RegionInput): Promise<{ id: string }> {
  const parsed = createRegionInputSchema.parse(input);
  try {
    const [row] = await getDb()
      .insert(schema.regionalOffices)
      .values({
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        status: parsed.status,
      })
      .returning({ id: schema.regionalOffices.id });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode wilayah sudah dipakai.");
    }
    throw error;
  }
}

export async function updateRegion(
  id: string,
  input: RegionInput,
): Promise<void> {
  const parsed = updateRegionInputSchema.parse(input);
  try {
    const updated = await getDb()
      .update(schema.regionalOffices)
      .set({
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        status: parsed.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.regionalOffices.id, id))
      .returning({ id: schema.regionalOffices.id });
    if (updated.length === 0) throw errors.notFound("Wilayah tidak ditemukan.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode wilayah sudah dipakai.");
    }
    throw error;
  }
}

export async function createBranch(input: BranchInput): Promise<{ id: string }> {
  const parsed = createBranchInputSchema.parse(input);
  await assertRegionExists(parsed.regionalOfficeId);
  try {
    const [row] = await getDb()
      .insert(schema.branchOffices)
      .values({
        regionalOfficeId: parsed.regionalOfficeId,
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        status: parsed.status,
      })
      .returning({ id: schema.branchOffices.id });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode cabang sudah dipakai.");
    }
    throw error;
  }
}

export async function updateBranch(
  id: string,
  input: BranchInput,
): Promise<void> {
  const parsed = updateBranchInputSchema.parse(input);
  await assertRegionExists(parsed.regionalOfficeId);
  try {
    const updated = await getDb()
      .update(schema.branchOffices)
      .set({
        regionalOfficeId: parsed.regionalOfficeId,
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        status: parsed.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.branchOffices.id, id))
      .returning({ id: schema.branchOffices.id });
    if (updated.length === 0) throw errors.notFound("Cabang tidak ditemukan.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode cabang sudah dipakai.");
    }
    throw error;
  }
}

function organizationValues(parsed: OrganizationInput) {
  const isFaskes = parsed.organizationType === "FASKES";
  const normalizedCode = isFaskes
    ? normalizeFaskesCode(parsed.faskesCode ?? "")
    : null;
  return {
    name: parsed.name,
    branchOfficeId: parsed.branchOfficeId,
    organizationType: parsed.organizationType,
    faskesClass: isFaskes ? parsed.faskesClass ?? null : null,
    faskesCode: isFaskes ? parsed.faskesCode!.trim() : null,
    faskesCodeNormalized: normalizedCode,
    category: CATEGORY_BY_TYPE[parsed.organizationType],
    serviceArea: parsed.serviceArea,
    addressLabel: parsed.addressLabel?.trim() || null,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    status: parsed.status,
  };
}

export async function createOrganization(
  input: OrganizationInput,
): Promise<{ id: string; branchOfficeId: string }> {
  const parsed = createOrganizationInputSchema.parse(input);
  await assertBranchExists(parsed.branchOfficeId);
  if (parsed.organizationType === "FASKES") {
    await assertFaskesCodeAvailable(normalizeFaskesCode(parsed.faskesCode ?? ""));
  }
  try {
    const [row] = await getDb()
      .insert(schema.stakeholders)
      .values({
        ...organizationValues(parsed),
        faskesType: null,
        isDemo: false,
        locationPrecision: "approximate",
        joinedAt: new Date().toISOString().slice(0, 10),
      })
      .returning({ id: schema.stakeholders.id });
    return { id: row.id, branchOfficeId: parsed.branchOfficeId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode Faskes sudah dipakai organisasi lain.");
    }
    throw error;
  }
}

export async function updateOrganization(
  id: string,
  input: OrganizationInput,
): Promise<void> {
  const parsed = updateOrganizationInputSchema.parse(input);
  await assertBranchExists(parsed.branchOfficeId);
  if (parsed.organizationType === "FASKES") {
    await assertFaskesCodeAvailable(
      normalizeFaskesCode(parsed.faskesCode ?? ""),
      id,
    );
  }
  try {
    const updated = await getDb()
      .update(schema.stakeholders)
      .set({
        ...organizationValues(parsed),
        updatedAt: new Date(),
      })
      .where(eq(schema.stakeholders.id, id))
      .returning({ id: schema.stakeholders.id });
    if (updated.length === 0) throw errors.notFound("Organisasi tidak ditemukan.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      throw errors.conflict("Kode Faskes sudah dipakai organisasi lain.");
    }
    throw error;
  }
}

export async function listHierarchyOptions(): Promise<{
  regions: Array<{ id: string; code: string; name: string }>;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    regionId: string;
    regionName: string;
  }>;
}> {
  const db = getDb();
  const [regions, branches] = await Promise.all([
    db
      .select({
        id: schema.regionalOffices.id,
        code: schema.regionalOffices.code,
        name: schema.regionalOffices.name,
      })
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.status, "ACTIVE"))
      .orderBy(asc(schema.regionalOffices.name)),
    db
      .select({
        id: schema.branchOffices.id,
        code: schema.branchOffices.code,
        name: schema.branchOffices.name,
        regionId: schema.branchOffices.regionalOfficeId,
        regionName: schema.regionalOffices.name,
      })
      .from(schema.branchOffices)
      .innerJoin(
        schema.regionalOffices,
        eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
      )
      .where(eq(schema.branchOffices.status, "ACTIVE"))
      .orderBy(asc(schema.branchOffices.name)),
  ]);
  return { regions, branches };
}

