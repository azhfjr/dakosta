import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { AppError, errors } from "@/lib/errors";
import {
  isSubTheme,
  isValidPeriod,
  periodLabel,
  periodOfDate,
  shiftPeriod,
  SUB_THEME_LABELS,
  SUB_THEMES,
  type SubTheme,
} from "@/lib/taxonomy";

export {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  currentPeriod,
  isContentType,
  isMainTheme,
  isSubTheme,
  isValidPeriod,
  jakartaToday,
  LEGACY_THEME_TO_SUBTHEME,
  MAIN_THEME_LABELS,
  MAIN_THEMES,
  periodLabel,
  periodOfDate,
  shiftPeriod,
  SUB_THEME_LABELS,
  SUB_THEMES,
} from "@/lib/taxonomy";
export type { ContentType, MainTheme } from "@/lib/taxonomy";

export type EdufastPolicy = {
  id: string;
  period: string;
  timezone: string;
  status: string;
  version: number;
  explanation: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subThemes: SubTheme[];
  createdBy: string;
  publishedBy: string | null;
};

async function attachSubThemes(
  rows: Array<typeof schema.edufastMonthlyPolicies.$inferSelect>,
): Promise<EdufastPolicy[]> {
  if (rows.length === 0) return [];
  const links = await getDb()
    .select({
      policyId: schema.edufastPolicySubthemes.policyId,
      subTheme: schema.edufastPolicySubthemes.subTheme,
    })
    .from(schema.edufastPolicySubthemes)
    .where(
      inArray(
        schema.edufastPolicySubthemes.policyId,
        rows.map((row) => row.id),
      ),
    );

  const byPolicy = new Map<string, SubTheme[]>();
  for (const link of links) {
    if (!isSubTheme(link.subTheme)) continue;
    const list = byPolicy.get(link.policyId) ?? [];
    list.push(link.subTheme);
    byPolicy.set(link.policyId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    period: row.periodYyyyMm,
    timezone: row.timezone,
    status: row.status,
    version: row.version,
    explanation: row.explanation,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subThemes: (byPolicy.get(row.id) ?? []).sort(
      (a, b) => SUB_THEMES.indexOf(a) - SUB_THEMES.indexOf(b),
    ),
    createdBy: row.createdBy,
    publishedBy: row.publishedBy,
  }));
}

export async function listPolicies(): Promise<EdufastPolicy[]> {
  const rows = await getDb()
    .select()
    .from(schema.edufastMonthlyPolicies)
    .orderBy(desc(schema.edufastMonthlyPolicies.periodYyyyMm), desc(schema.edufastMonthlyPolicies.version));
  return attachSubThemes(rows);
}

export async function getPolicyForPeriod(
  period: string,
): Promise<EdufastPolicy | null> {
  const [row] = await getDb()
    .select()
    .from(schema.edufastMonthlyPolicies)
    .where(
      and(
        eq(schema.edufastMonthlyPolicies.periodYyyyMm, period),
        eq(schema.edufastMonthlyPolicies.status, "PUBLISHED"),
      ),
    )
    .limit(1);
  if (!row) return null;
  const [policy] = await attachSubThemes([row]);
  return policy ?? null;
}

export async function getPolicyForDate(dateOnly: string): Promise<EdufastPolicy | null> {
  return getPolicyForPeriod(periodOfDate(dateOnly));
}

export type EdufastPolicyLoader = (period: string) => Promise<EdufastPolicy | null>;

export type EdufastResolution =
  | { allowed: true; policy: EdufastPolicy; subThemes: SubTheme[] }
  | { allowed: false; reason: string; period: string };

export async function resolveEdufastForDate(
  dateOnly: string,
  loadPolicy: EdufastPolicyLoader = getPolicyForPeriod,
): Promise<EdufastResolution> {
  const period = periodOfDate(dateOnly);
  const policy = await loadPolicy(period);
  if (!policy) {
    return {
      allowed: false,
      period,
      reason: `Belum ada kebijakan EDUFAST yang terbit untuk periode ${periodLabel(period)}. Pilih Non-EDUFAST atau hubungi Master Admin.`,
    };
  }
  return { allowed: true, policy, subThemes: policy.subThemes };
}

export async function assertEdufastSelection(
  input: {
    dateCreated: string;
    mainTheme: string;
    subTheme: string;
  },
  loadPolicy: EdufastPolicyLoader = getPolicyForPeriod,
): Promise<{ policyId: string | null; policyVersion: number | null }> {
  if (input.mainTheme !== "EDUFAST") {
    return { policyId: null, policyVersion: null };
  }
  if (!isSubTheme(input.subTheme)) {
    throw errors.validation("Sub-tema EDUFAST tidak dikenal.");
  }
  const resolution = await resolveEdufastForDate(input.dateCreated, loadPolicy);
  if (!resolution.allowed) {
    throw errors.validation(resolution.reason);
  }
  if (!resolution.subThemes.includes(input.subTheme)) {
    throw errors.validation(
      `Sub-tema ${SUB_THEME_LABELS[input.subTheme]} tidak termasuk kebijakan EDUFAST ${resolution.policy.period} (versi ${resolution.policy.version}).`,
    );
  }
  return { policyId: resolution.policy.id, policyVersion: resolution.policy.version };
}

function normalizeSubThemes(values: string[]): SubTheme[] {
  const unique = [...new Set(values)];
  if (unique.length === 0) {
    throw errors.validation("Pilih minimal satu sub-tema EDUFAST.");
  }
  const invalid = unique.filter((value) => !isSubTheme(value));
  if (invalid.length > 0) {
    throw errors.validation("Ada sub-tema yang tidak dikenal.");
  }
  return unique as SubTheme[];
}

export async function saveDraftPolicy(input: {
  policyId?: string;
  period: string;
  subThemes: string[];
  explanation?: string | null;
  actorId: string;
}): Promise<EdufastPolicy> {
  if (!isValidPeriod(input.period)) {
    throw errors.validation("Format periode harus YYYY-MM.");
  }
  const subThemes = normalizeSubThemes(input.subThemes);
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    let id = input.policyId;
    let action: "CREATED" | "UPDATED" = "UPDATED";

    if (id) {
      const [existing] = await tx
        .select()
        .from(schema.edufastMonthlyPolicies)
        .where(eq(schema.edufastMonthlyPolicies.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("Kebijakan tidak ditemukan.");
      if (existing.status !== "DRAFT") {
        throw errors.conflict(
          "Kebijakan yang sudah terbit tidak dapat diubah. Buat versi baru sebagai draf.",
        );
      }
      await tx
        .update(schema.edufastMonthlyPolicies)
        .set({
          periodYyyyMm: input.period,
          explanation: input.explanation ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.edufastMonthlyPolicies.id, id));
      await tx
        .delete(schema.edufastPolicySubthemes)
        .where(eq(schema.edufastPolicySubthemes.policyId, id));
    } else {
      const [created] = await tx
        .insert(schema.edufastMonthlyPolicies)
        .values({
          periodYyyyMm: input.period,
          timezone: "Asia/Jakarta",
          status: "DRAFT",
          version: 1,
          explanation: input.explanation ?? null,
          createdBy: input.actorId,
        })
        .returning({ id: schema.edufastMonthlyPolicies.id });
      if (!created) throw errors.server("Kebijakan tidak dapat disimpan.");
      id = created.id;
      action = "CREATED";
    }

    await tx
      .insert(schema.edufastPolicySubthemes)
      .values(subThemes.map((subTheme) => ({ policyId: id!, subTheme })));

    await tx.insert(schema.edufastPolicyEvents).values({
      policyId: id,
      action,
      actorId: input.actorId,
      snapshot: { period: input.period, subThemes },
    });

    const [row] = await tx
      .select()
      .from(schema.edufastMonthlyPolicies)
      .where(eq(schema.edufastMonthlyPolicies.id, id))
      .limit(1);
    return { rows: [row!], id: id! };
  });

  const [policy] = await attachSubThemes(result.rows);
  return policy!;
}

export async function publishPolicy(input: {
  policyId: string;
  actorId: string;
  explanation?: string | null;
}): Promise<EdufastPolicy> {
  const db = getDb();

  const row = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.edufastMonthlyPolicies)
      .where(eq(schema.edufastMonthlyPolicies.id, input.policyId))
      .limit(1);
    if (!current) throw errors.notFound("Kebijakan tidak ditemukan.");
    if (current.status === "PUBLISHED") {
      throw errors.conflict("Kebijakan ini sudah terbit.");
    }
    if (current.status === "ARCHIVED") {
      throw errors.conflict("Kebijakan yang diarsipkan tidak dapat diterbitkan.");
    }

    const [previous] = await tx
      .select({ id: schema.edufastMonthlyPolicies.id, version: schema.edufastMonthlyPolicies.version })
      .from(schema.edufastMonthlyPolicies)
      .where(
        and(
          eq(schema.edufastMonthlyPolicies.periodYyyyMm, current.periodYyyyMm),
          eq(schema.edufastMonthlyPolicies.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    let nextVersion = current.version;
    if (previous) {
      await tx
        .update(schema.edufastMonthlyPolicies)
        .set({ status: "ARCHIVED", updatedAt: new Date() })
        .where(eq(schema.edufastMonthlyPolicies.id, previous.id));
      nextVersion = Math.max(current.version, previous.version + 1);
    } else {
      const [maxRow] = await tx
        .select({ version: schema.edufastMonthlyPolicies.version })
        .from(schema.edufastMonthlyPolicies)
        .where(eq(schema.edufastMonthlyPolicies.periodYyyyMm, current.periodYyyyMm))
        .orderBy(desc(schema.edufastMonthlyPolicies.version))
        .limit(1);
      nextVersion = Math.max(current.version, (maxRow?.version ?? 0) + 1);
    }

    const [updated] = await tx
      .update(schema.edufastMonthlyPolicies)
      .set({
        status: "PUBLISHED",
        version: nextVersion,
        publishedBy: input.actorId,
        publishedAt: new Date(),
        explanation: input.explanation ?? current.explanation,
        updatedAt: new Date(),
      })
      .where(eq(schema.edufastMonthlyPolicies.id, current.id))
      .returning();

    await tx.insert(schema.edufastPolicyEvents).values({
      policyId: current.id,
      action: "PUBLISHED",
      actorId: input.actorId,
      snapshot: {
        period: current.periodYyyyMm,
        version: nextVersion,
        replacedPolicyId: previous?.id ?? null,
      },
    });

    return updated!;
  });

  const [policy] = await attachSubThemes([row]);
  return policy!;
}

export async function archivePolicy(input: {
  policyId: string;
  actorId: string;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.edufastMonthlyPolicies)
      .where(eq(schema.edufastMonthlyPolicies.id, input.policyId))
      .limit(1);
    if (!current) throw errors.notFound("Kebijakan tidak ditemukan.");
    if (current.status !== "PUBLISHED") {
      throw errors.validation("Hanya kebijakan terbit yang dapat diarsipkan.");
    }
    await tx
      .update(schema.edufastMonthlyPolicies)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(eq(schema.edufastMonthlyPolicies.id, current.id));
    await tx.insert(schema.edufastPolicyEvents).values({
      policyId: current.id,
      action: "ARCHIVED",
      actorId: input.actorId,
      snapshot: { period: current.periodYyyyMm, version: current.version },
    });
  });
}

export async function copyPreviousPolicy(input: {
  period: string;
  actorId: string;
}): Promise<EdufastPolicy> {
  if (!isValidPeriod(input.period)) {
    throw errors.validation("Format periode harus YYYY-MM.");
  }
  const source = await getPolicyForPeriod(shiftPeriod(input.period, -1));
  if (!source) {
    throw errors.validation(
      `Tidak ada kebijakan terbit pada ${periodLabel(shiftPeriod(input.period, -1))} untuk disalin.`,
    );
  }
  return saveDraftPolicy({
    period: input.period,
    subThemes: source.subThemes,
    explanation: `Disalin dari kebijakan ${source.period} versi ${source.version}.`,
    actorId: input.actorId,
  });
}

export type PolicyEventRow = {
  id: string;
  policyId: string;
  action: string;
  actorId: string | null;
  createdAt: Date;
};

export async function listPolicyEvents(limit = 20): Promise<PolicyEventRow[]> {
  return getDb()
    .select({
      id: schema.edufastPolicyEvents.id,
      policyId: schema.edufastPolicyEvents.policyId,
      action: schema.edufastPolicyEvents.action,
      actorId: schema.edufastPolicyEvents.actorId,
      createdAt: schema.edufastPolicyEvents.createdAt,
    })
    .from(schema.edufastPolicyEvents)
    .orderBy(desc(schema.edufastPolicyEvents.createdAt))
    .limit(limit);
}

export function ensurePolicyInput(input: unknown): {
  period: string;
  subThemes: string[];
  explanation?: string;
} {
  const value = input as {
    period?: unknown;
    subThemes?: unknown;
    explanation?: unknown;
  };
  if (typeof value?.period !== "string" || !isValidPeriod(value.period)) {
    throw new AppError("INVALID_PERIOD", "Periode harus berformat YYYY-MM.", 400);
  }
  if (!Array.isArray(value.subThemes)) {
    throw new AppError("INVALID_SUBTHEMES", "Sub-tema harus berupa daftar.", 400);
  }
  return {
    period: value.period,
    subThemes: value.subThemes.filter((item): item is string => typeof item === "string"),
    explanation:
      typeof value.explanation === "string" ? value.explanation : undefined,
  };
}
