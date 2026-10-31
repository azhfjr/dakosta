import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import type { ContentStatus } from "@/lib/content-status";
import { errors } from "@/lib/errors";
import { drainOutbox } from "@/lib/notifications";
import { assertCan } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const PENDING_STATUSES = ["SUBMITTED", "IN_REVIEW"] as const;

export const REVIEW_ACTIONS = ["APPROVE", "REQUEST_REVISION", "REJECT"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

const ACTION_TO_STATUS: Record<ReviewAction, ContentStatus> = {
  APPROVE: "APPROVED",
  REQUEST_REVISION: "REVISION_REQUIRED",
  REJECT: "REJECTED",
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
    title: "Konten ditolak",
    verb: "ditolak dan tidak dihitung sebagai capaian",
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
  status?: "ALL" | "SUBMITTED" | "IN_REVIEW";
  stakeholderId?: string;
  themeId?: string;
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
  stakeholderName: string;
  themeName: string;
  submittedAt: Date | null;
  updatedAt: Date;
  agingDays: number;
};

export type ReviewQueueResult = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: { ALL: number; SUBMITTED: number; IN_REVIEW: number };
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
  assertCan(user, "content:review");

  const db = getDb();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 15, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);

  const conditions: SQL[] = [
    filters.status && filters.status !== "ALL"
      ? eq(schema.contentSubmissions.status, filters.status)
      : inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
  ];

  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.themeId) {
    conditions.push(eq(schema.contentSubmissions.themeId, filters.themeId));
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

  const [rows, totalRow, countRows, oldestRow] = await Promise.all([
    db
      .select({
        id: schema.contentSubmissions.id,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        status: schema.contentSubmissions.status,
        version: schema.contentSubmissions.version,
        platform: schema.contentSubmissions.platform,
        submittedAt: schema.contentSubmissions.submittedAt,
        updatedAt: schema.contentSubmissions.updatedAt,
        stakeholderName: schema.stakeholders.name,
        themeName: schema.themes.name,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
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
      .where(inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]))
      .groupBy(schema.contentSubmissions.status),
    db
      .select({ submittedAt: schema.contentSubmissions.submittedAt })
      .from(schema.contentSubmissions)
      .where(inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]))
      .orderBy(asc(schema.contentSubmissions.submittedAt))
      .limit(1),
  ]);

  const total = Number(totalRow[0]?.total ?? 0);
  const counts = { ALL: 0, SUBMITTED: 0, IN_REVIEW: 0 };
  for (const row of countRows) {
    if (row.status === "SUBMITTED" || row.status === "IN_REVIEW") {
      counts[row.status] = Number(row.total);
      counts.ALL += Number(row.total);
    }
  }

  const now = new Date();

  return {
    items: rows.map((row) => ({
      ...row,
      status: row.status as ContentStatus,
      agingDays: agingDays(row.submittedAt, now),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    counts,
    oldestSubmittedAt: oldestRow[0]?.submittedAt ?? null,
    generatedAt: now,
  };
}

export type ReviewQueueOptions = {
  stakeholders: Array<{ id: string; name: string }>;
  themes: Array<{ id: string; name: string }>;
};

export async function listReviewQueueOptions(): Promise<ReviewQueueOptions> {
  const db = getDb();
  const [stakeholders, themes] = await Promise.all([
    db
      .select({ id: schema.stakeholders.id, name: schema.stakeholders.name })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.status, "ACTIVE"))
      .orderBy(asc(schema.stakeholders.name)),
    db
      .select({ id: schema.themes.id, name: schema.themes.name })
      .from(schema.themes)
      .where(eq(schema.themes.active, true))
      .orderBy(asc(schema.themes.sortOrder)),
  ]);
  return { stakeholders, themes };
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
  const subject = input.title ? `${input.referenceCode} — ${input.title}` : input.referenceCode;
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
        referenceCode: schema.contentSubmissions.referenceCode,
      })
      .from(schema.contentSubmissions)
      .where(eq(schema.contentSubmissions.id, input.submissionId))
      .for("update")
      .limit(1);

    if (!current) throw errors.notFound("Konten tidak ditemukan.");

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

  await drainOutbox().catch((error) => {
    console.error("[notifications] drain pasca-keputusan gagal", error);
  });

  return decision;
}

export async function countReviewQueue(): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.contentSubmissions)
    .where(inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]));
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
