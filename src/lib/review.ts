import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import type { ContentStatus } from "@/lib/content-status";
import { PENDING_STATUSES } from "@/lib/content-status";
import { errors } from "@/lib/errors";
import { drainOutbox } from "@/lib/notifications";
import {
  cachedRead,
  invalidateReadCache,
  readCacheKey,
} from "@/lib/read-cache";
import { assertCan, assertCapability } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";
import { isSubTheme, SUB_THEME_LABELS, type MainTheme } from "@/lib/taxonomy";
import { parsePeriod } from "@/lib/periods";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const REVIEW_ACTIONS = [
  "APPROVE",
  "REQUEST_REVISION",
  "REJECT",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

const ACTION_TO_STATUS: Record<ReviewAction, ContentStatus> = {
  APPROVE: "APPROVED",
  REQUEST_REVISION: "REVISION_REQUIRED",
  REJECT: "REVISION_REQUIRED",
};

const ACTION_AUDIT: Record<ReviewAction, string> = {
  APPROVE: "CONTENT_APPROVED",
  REQUEST_REVISION: "CONTENT_REVISION_REQUESTED",
  REJECT: "CONTENT_REJECTED",
};

const ACTION_NOTIFICATION: Record<
  ReviewAction,
  { eventType: string; title: string; verb: string }
> = {
  APPROVE: {
    eventType: "CONTENT_APPROVED",
    title: "Konten disetujui",
    verb: "telah disetujui dan kini dihitung sebagai capaian",
  },
  REQUEST_REVISION: {
    eventType: "CONTENT_REVISION_REQUESTED",
    title: "Konten perlu revisi",
    verb: "memerlukan revisi sebelum dapat divalidasi ulang",
  },
  REJECT: {
    eventType: "CONTENT_REJECTED",
    title: "Konten perlu revisi",
    verb: "dikembalikan sebagai Perlu Revisi dan belum dihitung sebagai capaian; perbaiki lalu kirim ulang",
  },
};

export const reviewChecklistSchema = z.object({
  relevansiTema: z.boolean(),
  akurasiKonten: z.boolean(),
  kelengkapanTautan: z.boolean(),
  etikaDanPrivasi: z.boolean(),
});

export type ReviewChecklist = z.infer<typeof reviewChecklistSchema>;

export const reviewDecisionSchema = z
  .object({
    submissionId: z.string().uuid(),
    expectedVersion: z.number().int().min(1),
    action: z.enum(REVIEW_ACTIONS),
    checklist: reviewChecklistSchema,
    notes: z.string().trim().max(2000).optional(),
    conflictOfInterest: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "APPROVE") {
      const complete = Object.values(value.checklist).every(Boolean);
      if (!complete) {
        ctx.addIssue({
          code: "custom",
          path: ["checklist"],
          message: "Semua butir checklist wajib dicentang sebelum menyetujui.",
        });
      }
      return;
    }

    if (!value.notes || value.notes.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Tuliskan alasan minimal 10 karakter untuk keputusan ini.",
      });
    }
  });

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export type ReviewQueueFilters = {
  status?: "ALL" | "SUBMITTED";
  stakeholderId?: string;
  orgType?: "FASKES" | "PEMDA" | "OTHER";
  mainTheme?: MainTheme;
  period?: string;
  subTheme?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ReviewQueueItem = {
  id: string;
  referenceCode: string;
  title: string | null;
  status: ContentStatus;
  version: number;
  platform: string;
  contentType: string | null;
  stakeholderName: string;
  themeName: string;
  submittedAt: Date | null;
  firstSubmittedAt: Date | null;
  resubmissionCount: number;
  updatedAt: Date;
  agingDays: number;
};

export type ReviewQueueResult = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: {
    ALL: number;
    SUBMITTED: number;
  };
  oldestSubmittedAt: Date | null;
  generatedAt: Date;
};

function agingDays(submittedAt: Date | null, now = new Date()): number {
  if (!submittedAt) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - submittedAt.getTime()) / 86_400_000),
  );
}

export async function listReviewQueue(
  user: SessionUser,
  filters: ReviewQueueFilters = {},
): Promise<ReviewQueueResult> {
  assertCapability(user, "sla:read");
  return cachedRead(
    readCacheKey(user, [
      "review-queue",
      filters.status ?? "ALL",
      filters.stakeholderId ?? null,
      filters.orgType ?? null,
      filters.mainTheme ?? null,
      filters.period ?? null,
      filters.subTheme ?? null,
      filters.search ?? null,
      filters.page ?? 1,
      filters.pageSize ?? 15,
    ]),
    () => loadReviewQueue(user, filters),
    { ttlMs: 5_000 },
  );
}

async function loadReviewQueue(
  user: SessionUser,
  filters: ReviewQueueFilters,
): Promise<ReviewQueueResult> {
  const db = getDb();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 15, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);

  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  const conditions: SQL[] = [
    filters.status && filters.status !== "ALL"
      ? eq(schema.contentSubmissions.status, filters.status)
      : inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
  ];
  if (scopePredicate) conditions.push(scopePredicate);

  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.orgType) {
    conditions.push(
      inArray(
        schema.contentSubmissions.stakeholderId,
        db
          .select({ id: schema.stakeholders.id })
          .from(schema.stakeholders)
          .where(eq(schema.stakeholders.organizationType, filters.orgType)),
      ),
    );
  }
  if (filters.mainTheme) {
    conditions.push(eq(schema.contentSubmissions.mainTheme, filters.mainTheme));
  }
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }
  if (filters.period) {
    const period = parsePeriod(filters.period);
    conditions.push(
      gte(schema.contentSubmissions.submittedAt, period.start),
      lt(schema.contentSubmissions.submittedAt, period.endExclusive),
    );
  }
  if (filters.search) {
    const needle = `%${filters.search}%`;
    const search = or(
      ilike(schema.contentSubmissions.referenceCode, needle),
      ilike(schema.contentSubmissions.title, needle),
      ilike(schema.stakeholders.name, needle),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);
  const filterOnly = conditions.slice(1);
  const pendingWhere = and(
    inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
    ...filterOnly,
  );

  const [rows, totalRow, countRows, oldestRow] = await Promise.all([
    db
      .select({
        id: schema.contentSubmissions.id,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        status: schema.contentSubmissions.status,
        version: schema.contentSubmissions.version,
        platform: schema.contentSubmissions.platform,
        contentType: schema.contentSubmissions.contentType,
        submittedAt: schema.contentSubmissions.submittedAt,
        firstSubmittedAt: schema.contentSubmissions.firstSubmittedAt,
        resubmissionCount: schema.contentSubmissions.resubmissionCount,
        updatedAt: schema.contentSubmissions.updatedAt,
        stakeholderName: schema.stakeholders.name,
        subTheme: schema.contentSubmissions.subTheme,
        themeName: schema.themes.name,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .leftJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(where)
      .orderBy(asc(schema.contentSubmissions.submittedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(where),
    db
      .select({ status: schema.contentSubmissions.status, total: count() })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(pendingWhere)
      .groupBy(schema.contentSubmissions.status),
    db
      .select({ submittedAt: schema.contentSubmissions.submittedAt })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(pendingWhere)
      .orderBy(asc(schema.contentSubmissions.submittedAt))
      .limit(1),
  ]);

  const total = Number(totalRow[0]?.total ?? 0);
  const counts = { ALL: 0, SUBMITTED: 0 };
  for (const row of countRows) {
    if (row.status === "SUBMITTED") {
      counts.SUBMITTED = Number(row.total);
      counts.ALL += Number(row.total);
    }
  }

  const now = new Date();

  return {
    items: rows.map((row) => {
      const subTheme = isSubTheme(row.subTheme) ? row.subTheme : null;
      return {
        ...row,
        status: row.status as ContentStatus,
        themeName:
          row.themeName ??
          (subTheme ? SUB_THEME_LABELS[subTheme] : "Tanpa tema"),
        agingDays: agingDays(row.firstSubmittedAt ?? row.submittedAt, now),
      };
    }),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    counts,
    oldestSubmittedAt: oldestRow[0]?.submittedAt ?? null,
    generatedAt: now,
  };
}

export type ReviewDecisionResult = {
  submissionId: string;
  referenceCode: string;
  status: ContentStatus;
  version: number;
  approvedAt: Date | null;
  notificationId: string | null;
};

async function notifySubmitter(
  tx: Transaction,
  input: {
    submissionId: string;
    referenceCode: string;
    title: string | null;
    version: number;
    action: ReviewAction;
    notes: string | null;
    recipientId: string;
  },
): Promise<string | null> {
  const config = ACTION_NOTIFICATION[input.action];
  const dedupeKey = `content.decision:${input.submissionId}:${input.version}:${input.recipientId}`;
  const subject = input.title
    ? `${input.referenceCode} — ${input.title}`
    : input.referenceCode;
  const body = `${subject} ${config.verb}.${
    input.notes ? ` Catatan admin: ${input.notes}` : ""
  }`;

  const inserted = await tx
    .insert(schema.notifications)
    .values({
      recipientId: input.recipientId,
      eventType: config.eventType,
      title: config.title,
      body,
      objectType: "CONTENT_SUBMISSION",
      objectId: input.submissionId,
      href: `/client/konten/${input.submissionId}`,
      dedupeKey,
    })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });

  let notificationId = inserted[0]?.id ?? null;
  if (!notificationId) {
    const [existing] = await tx
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey))
      .limit(1);
    notificationId = existing?.id ?? null;
  }

  await tx
    .insert(schema.outboxEvents)
    .values({
      eventKey: dedupeKey,
      aggregateType: "CONTENT_SUBMISSION",
      aggregateId: input.submissionId,
      eventType: "notification.created",
      payload: {
        notificationId,
        recipientId: input.recipientId,
        title: config.title,
        body,
        href: `/client/konten/${input.submissionId}`,
        referenceCode: input.referenceCode,
      },
      recipientId: input.recipientId,
      notificationId,
    })
    .onConflictDoNothing();

  return notificationId;
}

export async function reviewSubmission(
  admin: SessionUser,
  input: ReviewDecisionInput,
  requestId?: string,
): Promise<ReviewDecisionResult> {
  assertCan(admin, "content:review");

  const db = getDb();
  const nextStatus = ACTION_TO_STATUS[input.action];
  const now = new Date();
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const decision = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: schema.contentSubmissions.status,
        version: schema.contentSubmissions.version,
        submittedBy: schema.contentSubmissions.submittedBy,
        createdBy: schema.contentSubmissions.createdBy,
        referenceCode: schema.contentSubmissions.referenceCode,
        organizationId: schema.contentSubmissions.stakeholderId,
        organizationBranchId: schema.stakeholders.branchOfficeId,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(eq(schema.contentSubmissions.id, input.submissionId))
      .for("update")
      .limit(1);

    if (!current) throw errors.notFound("Konten tidak ditemukan.");

    if (admin.role === "BRANCH_ADMIN") {
      if (
        !current.organizationBranchId ||
        admin.scope.kind !== "BRANCH" ||
        current.organizationBranchId !== admin.scope.branchId
      ) {
        throw errors.notFound("Konten tidak ditemukan.");
      }
    }

    if (
      admin.role !== "MASTER_ADMIN" &&
      (current.createdBy === admin.id || current.submittedBy === admin.id)
    ) {
      throw errors.forbidden(
        "Anda tidak dapat menilai konten yang Anda kirim sendiri.",
      );
    }

    if (
      current.version !== input.expectedVersion ||
      !(PENDING_STATUSES as readonly string[]).includes(current.status)
    ) {
      throw errors.conflict(
        "Konten sudah diputuskan atau versinya berubah. Muat ulang halaman untuk melihat status terbaru.",
        {
          currentStatus: current.status,
          currentVersion: current.version,
          referenceCode: current.referenceCode,
        },
      );
    }

    const [updated] = await tx
      .update(schema.contentSubmissions)
      .set({
        status: nextStatus,
        reviewedBy: admin.id,
        decisionReason: notes,
        approvedAt: input.action === "APPROVE" ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.contentSubmissions.id, input.submissionId),
          eq(schema.contentSubmissions.version, input.expectedVersion),
          inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
        ),
      )
      .returning();

    if (!updated) {
      throw errors.conflict(
        "Konten berubah saat keputusan disimpan. Muat ulang halaman lalu coba lagi.",
      );
    }

    await tx.insert(schema.contentReviews).values({
      submissionId: updated.id,
      version: updated.version,
      reviewerId: admin.id,
      action: input.action,
      checklist: input.checklist,
      notes,
      previousStatus: current.status,
      nextStatus,
      conflictOfInterest: input.conflictOfInterest ?? false,
      reviewerRole: admin.role,
      reviewerBranchId:
        admin.role === "BRANCH_ADMIN" ? current.organizationBranchId : null,
      decisionSource:
        admin.role === "MASTER_ADMIN" ? "MASTER_OVERRIDE" : "NORMAL",
    });

    const notificationId = await notifySubmitter(tx, {
      submissionId: updated.id,
      referenceCode: updated.referenceCode,
      title: updated.title,
      version: updated.version,
      action: input.action,
      notes,
      recipientId: updated.submittedBy,
    });

    await tx.insert(schema.auditLogs).values({
      actorId: admin.id,
      actorRole: admin.role,
      action: ACTION_AUDIT[input.action],
      recordType: "CONTENT_SUBMISSION",
      recordId: updated.id,
      branchId: current.organizationBranchId,
      organizationId: current.organizationId,
      before: {
        status: current.status,
        version: current.version,
      },
      after: {
        status: nextStatus,
        version: updated.version,
        referenceCode: updated.referenceCode,
        checklist: input.checklist,
        decisionReason: notes,
        conflictOfInterest: input.conflictOfInterest ?? false,
        notificationId,
      },
      requestId: requestId ?? null,
    });

    return {
      submissionId: updated.id,
      referenceCode: updated.referenceCode,
      status: nextStatus,
      version: updated.version,
      approvedAt: updated.approvedAt,
      notificationId,
    };
  });

  invalidateReadCache();
  await drainOutbox().catch((error) => {
    console.error("[notifications] drain pasca-keputusan gagal", error);
  });

  return decision;
}

export type RevokeResult = {
  submissionId: string;
  referenceCode: string;
  status: ContentStatus;
};

/**
 * Master-only corrective action. Revoking an approved item removes it from the
 * approved-only KPI immediately; the historical review trail is preserved.
 */
export async function revokeSubmission(
  master: SessionUser,
  input: { submissionId: string; reason: string },
  requestId?: string,
): Promise<RevokeResult> {
  assertCapability(master, "content:revoke");
  const notes = input.reason.trim();
  if (notes.length < 10) {
    throw errors.validation("Alasan pencabutan minimal 10 karakter.");
  }
  const now = new Date();

  const result = await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: schema.contentSubmissions.status,
        version: schema.contentSubmissions.version,
        submittedBy: schema.contentSubmissions.submittedBy,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        organizationId: schema.contentSubmissions.stakeholderId,
        branchOfficeId: schema.stakeholders.branchOfficeId,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(eq(schema.contentSubmissions.id, input.submissionId))
      .for("update")
      .limit(1);

    if (!current) throw errors.notFound("Konten tidak ditemukan.");
    if (current.status !== "APPROVED") {
      throw errors.conflict(
        "Hanya konten berstatus Disetujui yang dapat dicabut.",
        { currentStatus: current.status },
      );
    }

    const [updated] = await tx
      .update(schema.contentSubmissions)
      .set({
        status: "REVISION_REQUIRED",
        decisionReason: notes,
        revokedAt: now,
        approvedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.contentSubmissions.id, input.submissionId),
          eq(schema.contentSubmissions.status, "APPROVED"),
        ),
      )
      .returning({ id: schema.contentSubmissions.id });

    if (!updated) {
      throw errors.conflict(
        "Status konten berubah. Muat ulang halaman lalu coba lagi.",
      );
    }

    await tx.insert(schema.contentReviews).values({
      submissionId: input.submissionId,
      version: current.version,
      reviewerId: master.id,
      action: "REVOKE",
      checklist: {},
      notes,
      previousStatus: current.status,
      nextStatus: "REVISION_REQUIRED",
      conflictOfInterest: false,
      reviewerRole: master.role,
      reviewerBranchId: null,
      decisionSource: "MASTER_OVERRIDE",
    });

    const dedupeKey = `content.revoked:${input.submissionId}:${current.version}:${current.submittedBy}`;
    const subject = current.title
      ? `${current.referenceCode} — ${current.title}`
      : current.referenceCode;
    const body = `${subject} dicabut oleh Master Admin dan dikembalikan sebagai Perlu Revisi. Alasan: ${notes}`;

    const inserted = await tx
      .insert(schema.notifications)
      .values({
        recipientId: current.submittedBy,
        eventType: "CONTENT_REVOKED",
        title: "Konten perlu revisi",
        body,
        objectType: "CONTENT_SUBMISSION",
        objectId: input.submissionId,
        href: `/client/konten/${input.submissionId}`,
        branchOfficeId: current.branchOfficeId,
        organizationId: current.organizationId,
        dedupeKey,
      })
      .onConflictDoNothing()
      .returning({ id: schema.notifications.id });

    const notificationId = inserted[0]?.id ?? null;

    await tx
      .insert(schema.outboxEvents)
      .values({
        eventKey: dedupeKey,
        aggregateType: "CONTENT_SUBMISSION",
        aggregateId: input.submissionId,
        eventType: "notification.created",
        payload: {
          notificationId,
          recipientId: current.submittedBy,
          title: "Konten perlu revisi",
          body,
          href: `/client/konten/${input.submissionId}`,
          referenceCode: current.referenceCode,
        },
        recipientId: current.submittedBy,
        notificationId,
      })
      .onConflictDoNothing();

    await tx.insert(schema.auditLogs).values({
      actorId: master.id,
      actorRole: master.role,
      action: "CONTENT_REVOKED",
      recordType: "CONTENT_SUBMISSION",
      recordId: input.submissionId,
      branchId: current.branchOfficeId,
      organizationId: current.organizationId,
      reason: notes,
      before: { status: current.status, version: current.version },
      after: {
        status: "REVISION_REQUIRED",
        version: current.version,
        notificationId,
      },
      requestId: requestId ?? null,
    });

    return {
      submissionId: input.submissionId,
      referenceCode: current.referenceCode,
      status: "REVISION_REQUIRED" as ContentStatus,
    };
  });

  invalidateReadCache();
  await drainOutbox().catch((error) => {
    console.error("[notifications] drain pasca-pencabutan gagal", error);
  });

  return result;
}

export async function countReviewQueue(user: SessionUser): Promise<number> {
  return cachedRead(
    readCacheKey(user, ["review-queue-count"]),
    () => loadReviewQueueCount(user),
    { ttlMs: 5_000 },
  );
}

async function loadReviewQueueCount(user: SessionUser): Promise<number> {
  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.contentSubmissions)
    .where(
      scopePredicate
        ? and(
            inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
            scopePredicate,
          )
        : inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
    );
  return Number(row?.total ?? 0);
}

export async function listRecentDecisions(limit = 8) {
  const rows = await getDb()
    .select({
      id: schema.contentReviews.id,
      action: schema.contentReviews.action,
      notes: schema.contentReviews.notes,
      createdAt: schema.contentReviews.createdAt,
      referenceCode: schema.contentSubmissions.referenceCode,
      submissionId: schema.contentSubmissions.id,
      stakeholderName: schema.stakeholders.name,
    })
    .from(schema.contentReviews)
    .innerJoin(
      schema.contentSubmissions,
      eq(schema.contentSubmissions.id, schema.contentReviews.submissionId),
    )
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .orderBy(desc(schema.contentReviews.createdAt))
    .limit(Math.min(Math.max(limit, 1), 30));
  return rows;
}
