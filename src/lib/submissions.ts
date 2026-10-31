import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import { contentScopePredicate, isOrganizationInScope } from "@/lib/authz/predicates";
import { errors, AppError } from "@/lib/errors";
import { CONTENT_STATUSES, type ContentStatus } from "@/lib/content-status";
import { resolvePrecision } from "@/lib/geo";
import { drainOutbox } from "@/lib/notifications";
import { assertStakeholderAccess, assertCan } from "@/lib/rbac";
import { generateReferenceCode } from "@/lib/reference";
import { assertEdufastSelection } from "@/lib/edufast/policy";
import { duplicateDetails, duplicateMessage } from "@/lib/privacy/duplicate";
import type { SessionUser } from "@/lib/session";
import { isSubTheme, SUB_THEME_LABELS } from "@/lib/taxonomy";
import { normalizePublishedUrl } from "@/lib/url";
import {
  type SubmissionInput,
  type SubmissionLocationInput,
} from "@/lib/validation/content";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type SavedSubmission = {
  id: string;
  referenceCode: string;
  status: ContentStatus;
  version: number;
  submittedAt: Date | null;
  updatedAt: Date;
  created: boolean;
};

export type SubmissionListFilters = {
  status?: ContentStatus;
  limit?: number;
  stakeholderId?: string;
  subTheme?: string;
};

export type SubmissionListItem = {
  id: string;
  referenceCode: string;
  title: string | null;
  status: ContentStatus;
  version: number;
  platform: string;
  themeName: string;
  stakeholderName: string;
  dateCreated: string;
  publishedAt: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  updatedAt: Date;
};

export type SubmissionTimelineEntry = {
  key: string;
  label: string;
  description: string;
  at: Date;
};

export type SubmissionDetail = {
  id: string;
  referenceCode: string;
  title: string | null;
  narrative: string;
  status: ContentStatus;
  version: number;
  platform: string;
  publishedUrl: string;
  dateCreated: string;
  publishedAt: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  updatedAt: Date;
  decisionReason: string | null;
  theme: { id: string | null; name: string };
  contentType: string | null;
  mainTheme: string | null;
  subTheme: string | null;
  edufastPolicyVersion: number | null;
  resubmissionCount: number;
  stakeholder: { id: string; name: string; serviceArea: string };
  location: {
    latitude: number;
    longitude: number;
    label: string;
    source: string;
    precision: string;
    verifiedStatus: string;
    accuracyMeters: number | null;
  } | null;
  reviews: Array<{
    id: string;
    action: string;
    version: number;
    notes: string | null;
    nextStatus: string;
    createdAt: Date;
    reviewerName: string;
    conflictOfInterest: boolean;
  }>;
  revisions: Array<{
    id: string;
    version: number;
    reason: string | null;
    createdAt: Date;
    actorName: string;
  }>;
  timeline: SubmissionTimelineEntry[];
};

const STATUS_SET = new Set<string>(CONTENT_STATUSES);

function isContentStatus(value: string): value is ContentStatus {
  return STATUS_SET.has(value);
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

function toSaved(
  row: {
    id: string;
    referenceCode: string;
    status: string;
    version: number;
    submittedAt: Date | null;
    updatedAt: Date;
  },
  created = false,
): SavedSubmission {
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    status: isContentStatus(row.status) ? row.status : "DRAFT",
    version: row.version,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
    created,
  };
}

export async function listSubmissions(
  user: SessionUser,
  filters: SubmissionListFilters = {},
): Promise<SubmissionListItem[]> {
  assertCan(user, "stakeholder:read");

  const conditions: SQL[] = [];
  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scopePredicate) conditions.push(scopePredicate);
  if (filters.status) {
    conditions.push(eq(schema.contentSubmissions.status, filters.status));
  }
  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }

  const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);

  const rows = await getDb()
    .select({
      id: schema.contentSubmissions.id,
      referenceCode: schema.contentSubmissions.referenceCode,
      title: schema.contentSubmissions.title,
      status: schema.contentSubmissions.status,
      version: schema.contentSubmissions.version,
      platform: schema.contentSubmissions.platform,
      themeName: schema.themes.name,
      subTheme: schema.contentSubmissions.subTheme,
      stakeholderName: schema.stakeholders.name,
      dateCreated: schema.contentSubmissions.dateCreated,
      publishedAt: schema.contentSubmissions.publishedAt,
      submittedAt: schema.contentSubmissions.submittedAt,
      approvedAt: schema.contentSubmissions.approvedAt,
      updatedAt: schema.contentSubmissions.updatedAt,
    })
    .from(schema.contentSubmissions)
    .leftJoin(schema.themes, eq(schema.themes.id, schema.contentSubmissions.themeId))
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.contentSubmissions.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    themeName:
      row.themeName ??
      (isSubTheme(row.subTheme) ? SUB_THEME_LABELS[row.subTheme] : "Tanpa tema"),
    status: isContentStatus(row.status) ? row.status : "DRAFT",
  }));
}

export async function getSubmissionStatusCounts(
  user: SessionUser,
): Promise<Record<ContentStatus, number>> {
  assertCan(user, "stakeholder:read");

  const conditions: SQL[] = [];
  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scopePredicate) conditions.push(scopePredicate);

  const rows = await getDb()
    .select({ status: schema.contentSubmissions.status, total: count() })
    .from(schema.contentSubmissions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(schema.contentSubmissions.status);

  const counts = Object.fromEntries(
    CONTENT_STATUSES.map((status) => [status, 0]),
  ) as Record<ContentStatus, number>;
  for (const row of rows) {
    if (isContentStatus(row.status)) {
      counts[row.status] = Number(row.total);
    }
  }
  return counts;
}

function buildTimeline(
  submission: {
    status: string;
    createdAt: Date;
    submittedAt: Date | null;
    approvedAt: Date | null;
    decisionReason: string | null;
  },
  reviews: SubmissionDetail["reviews"],
): SubmissionTimelineEntry[] {
  const entries: SubmissionTimelineEntry[] = [
    {
      key: "created",
      label: "Draf dibuat",
      description: "Konten disimpan sebagai draf oleh pelapor.",
      at: submission.createdAt,
    },
  ];

  if (submission.submittedAt) {
    entries.push({
      key: "submitted",
      label: "Dikirim untuk validasi",
      description: "Konten masuk antrean validasi admin.",
      at: submission.submittedAt,
    });
  }

  for (const review of reviews) {
    const label =
      review.action === "APPROVE"
        ? "Disetujui"
        : review.action === "REQUEST_REVISION"
          ? "Diminta revisi"
          : "Ditolak";
    entries.push({
      key: `review-${review.id}`,
      label,
      description: review.notes ?? `Keputusan admin untuk versi ${review.version}.`,
      at: review.createdAt,
    });
  }

  if (submission.approvedAt) {
    entries.push({
      key: "approved",
      label: "Tercatat sebagai konten disetujui",
      description: "Konten dihitung dalam capaian karena berstatus disetujui.",
      at: submission.approvedAt,
    });
  }

  return entries.sort((left, right) => left.at.getTime() - right.at.getTime());
}

export async function getSubmissionDetail(
  user: SessionUser,
  submissionId: string,
): Promise<SubmissionDetail> {
  assertCan(user, "stakeholder:read");

  const db = getDb();
  const [row] = await db
    .select({
      submission: schema.contentSubmissions,
      themeName: schema.themes.name,
      stakeholderName: schema.stakeholders.name,
      stakeholderArea: schema.stakeholders.serviceArea,
      stakeholderBranchId: schema.stakeholders.branchOfficeId,
      location: schema.locations,
    })
    .from(schema.contentSubmissions)
    .leftJoin(schema.themes, eq(schema.themes.id, schema.contentSubmissions.themeId))
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .innerJoin(schema.locations, eq(schema.locations.id, schema.contentSubmissions.locationId))
    .where(eq(schema.contentSubmissions.id, submissionId))
    .limit(1);

  if (!row) throw errors.notFound("Konten tidak ditemukan.");

  if (
    !isOrganizationInScope(user.scope, {
      id: row.submission.stakeholderId,
      branchOfficeId: row.stakeholderBranchId,
    })
  ) {
    await db.insert(schema.auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "CONTENT_SUBMISSION",
      recordId: submissionId,
      after: { reason: "cross_scope_read" },
    });
    throw errors.notFound("Konten tidak ditemukan.");
  }

  const [reviewRows, revisionRows] = await Promise.all([
    db
      .select({
        id: schema.contentReviews.id,
        action: schema.contentReviews.action,
        version: schema.contentReviews.version,
        notes: schema.contentReviews.notes,
        nextStatus: schema.contentReviews.nextStatus,
        conflictOfInterest: schema.contentReviews.conflictOfInterest,
        createdAt: schema.contentReviews.createdAt,
        reviewerName: schema.user.name,
      })
      .from(schema.contentReviews)
      .innerJoin(schema.user, eq(schema.user.id, schema.contentReviews.reviewerId))
      .where(eq(schema.contentReviews.submissionId, submissionId))
      .orderBy(asc(schema.contentReviews.createdAt)),
    db
      .select({
        id: schema.contentRevisions.id,
        version: schema.contentRevisions.version,
        reason: schema.contentRevisions.reason,
        createdAt: schema.contentRevisions.createdAt,
        actorName: schema.user.name,
      })
      .from(schema.contentRevisions)
      .innerJoin(schema.user, eq(schema.user.id, schema.contentRevisions.actorId))
      .where(eq(schema.contentRevisions.submissionId, submissionId))
      .orderBy(asc(schema.contentRevisions.createdAt)),
  ]);

  const submission = row.submission;

  return {
    id: submission.id,
    referenceCode: submission.referenceCode,
    title: submission.title,
    narrative: submission.narrative,
    status: isContentStatus(submission.status) ? submission.status : "DRAFT",
    version: submission.version,
    platform: submission.platform,
    publishedUrl: submission.publishedUrl,
    dateCreated: submission.dateCreated,
    publishedAt: submission.publishedAt,
    submittedAt: submission.submittedAt,
    approvedAt: submission.approvedAt,
    updatedAt: submission.updatedAt,
    decisionReason: submission.decisionReason,
    theme: {
      id: submission.themeId,
      name:
        row.themeName ??
        (isSubTheme(submission.subTheme)
          ? SUB_THEME_LABELS[submission.subTheme]
          : "Tanpa tema"),
    },
    contentType: submission.contentType,
    mainTheme: submission.mainTheme,
    subTheme: submission.subTheme,
    edufastPolicyVersion: submission.edufastPolicyVersion,
    resubmissionCount: submission.resubmissionCount,
    stakeholder: {
      id: submission.stakeholderId,
      name: row.stakeholderName,
      serviceArea: row.stakeholderArea,
    },
    location: row.location
      ? {
          latitude: row.location.latitude,
          longitude: row.location.longitude,
          label: row.location.label,
          source: row.location.source,
          precision: row.location.precision,
          verifiedStatus: row.location.verifiedStatus,
          accuracyMeters: row.location.accuracyMeters,
        }
      : null,
    reviews: reviewRows,
    revisions: revisionRows,
    timeline: buildTimeline(submission, reviewRows),
  };
}

async function insertLocation(
  tx: Transaction,
  location: SubmissionLocationInput,
  fallbackLabel: string,
) {
  const precision = resolvePrecision(location.source, location.accuracyMeters ?? null);
  const [row] = await tx
    .insert(schema.locations)
    .values({
      latitude: location.latitude,
      longitude: location.longitude,
      label: location.label || fallbackLabel,
      source: location.source,
      accuracyMeters: location.accuracyMeters ?? null,
      consentAt: location.source === "device_gps" ? new Date() : null,
      verifiedStatus: location.source === "device_gps" ? "VERIFIED" : "MANUAL_UNVERIFIED",
      precision,
    })
    .returning({ id: schema.locations.id });

  if (!row) throw errors.server("Lokasi konten tidak dapat disimpan.");
  return row.id;
}

async function insertRegisteredPlaceholderLocation(
  tx: Transaction,
  stakeholder: { id: string; name: string; latitude: number; longitude: number },
) {
  const [row] = await tx
    .insert(schema.locations)
    .values({
      latitude: stakeholder.latitude,
      longitude: stakeholder.longitude,
      label: `${stakeholder.name} (lokasi terdaftar)`,
      source: "registered_stakeholder",
      accuracyMeters: null,
      consentAt: null,
      verifiedStatus: "MANUAL_UNVERIFIED",
      precision: "approximate",
    })
    .returning({ id: schema.locations.id });

  if (!row) throw errors.server("Lokasi konten tidak dapat disimpan.");
  return row.id;
}

async function notifyAdmins(
  tx: Transaction,
  input: {
    submissionId: string;
    referenceCode: string;
    stakeholderName: string;
    title: string | null;
    version: number;
    branchOfficeId: string | null;
    organizationId: string;
  },
) {
  const recipients = await tx
    .select({ id: schema.user.id, role: schema.userMemberships.role })
    .from(schema.user)
    .innerJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.user.id))
    .innerJoin(
      schema.userMemberships,
      eq(schema.userMemberships.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.userProfiles.active, true),
        eq(schema.userProfiles.status, "ACTIVE"),
        isNull(schema.userMemberships.revokedAt),
        input.branchOfficeId
          ? and(
              eq(schema.userMemberships.role, "BRANCH_ADMIN"),
              eq(schema.userMemberships.branchOfficeId, input.branchOfficeId),
            )
          : eq(schema.userMemberships.role, "MASTER_ADMIN"),
      ),
    );

  if (recipients.length === 0) return;

  const dedupeBase = `content.submitted:${input.submissionId}:${input.version}`;
  const notificationTitle = "Konten baru menunggu validasi";
  const notificationBody = `${input.stakeholderName} mengirim ${input.referenceCode}${
    input.title ? ` — ${input.title}` : ""
  }.`;

  for (const admin of recipients) {
    const dedupeKey = `${dedupeBase}:${admin.id}`;
    const href =
      admin.role === "BRANCH_ADMIN"
        ? `/cabang/review/${input.submissionId}`
        : `/admin/validasi/${input.submissionId}`;

    const inserted = await tx
      .insert(schema.notifications)
      .values({
        recipientId: admin.id,
        eventType: "CONTENT_SUBMITTED",
        title: notificationTitle,
        body: notificationBody,
        objectType: "CONTENT_SUBMISSION",
        objectId: input.submissionId,
        href,
        branchOfficeId: input.branchOfficeId,
        organizationId: input.organizationId,
        dedupeKey,
      })
      .onConflictDoNothing()
      .returning({ id: schema.notifications.id });

    let notificationId = inserted[0]?.id;
    if (!notificationId) {
      const [existing] = await tx
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(eq(schema.notifications.dedupeKey, dedupeKey))
        .limit(1);
      notificationId = existing?.id;
    }

    await tx
      .insert(schema.outboxEvents)
      .values({
        eventKey: dedupeKey,
        aggregateType: "CONTENT_SUBMISSION",
        aggregateId: input.submissionId,
        eventType: "notification.created",
        payload: {
          notificationId: notificationId ?? null,
          recipientId: admin.id,
          title: notificationTitle,
          body: notificationBody,
          href,
          referenceCode: input.referenceCode,
        },
        recipientId: admin.id,
        notificationId: notificationId ?? null,
      })
      .onConflictDoNothing();
  }
}

function snapshotFor(input: {
  title: string | null;
  narrative: string;
  publishedUrl: string;
  platform: string;
  themeId: string | null;
  contentType?: string | null;
  mainTheme?: string | null;
  subTheme?: string | null;
  dateCreated: string;
  publishedAt: string | null;
  location: SubmissionLocationInput | null;
}): Record<string, unknown> {
  return {
    title: input.title,
    narrative: input.narrative,
    publishedUrl: input.publishedUrl,
    platform: input.platform,
    themeId: input.themeId,
    contentType: input.contentType ?? null,
    mainTheme: input.mainTheme ?? null,
    subTheme: input.subTheme ?? null,
    dateCreated: input.dateCreated,
    publishedAt: input.publishedAt,
    location: input.location
      ? {
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          label: input.location.label,
          source: input.location.source,
        }
      : null,
  };
}

export async function saveSubmission(
  user: SessionUser,
  input: SubmissionInput,
  requestId?: string,
): Promise<SavedSubmission> {
  assertCan(user, "content:create");
  const stakeholderId =
    user.scope.kind === "ORG" ? user.scope.organizationId : input.stakeholderId;
  if (!stakeholderId) {
    throw errors.validation("Organisasi pelapor belum terhubung ke akun Anda.");
  }
  await assertStakeholderAccess(user, stakeholderId);

  const db = getDb();

  const [idempotent] = await db
    .select()
    .from(schema.contentSubmissions)
    .where(
      and(
        eq(schema.contentSubmissions.idempotencyKey, input.idempotencyKey),
        eq(schema.contentSubmissions.createdBy, user.id),
      ),
    )
    .limit(1);

  if (idempotent) return toSaved(idempotent);

  const [stakeholder] = await db
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      latitude: schema.stakeholders.latitude,
      longitude: schema.stakeholders.longitude,
      branchOfficeId: schema.stakeholders.branchOfficeId,
    })
    .from(schema.stakeholders)
    .where(
      and(
        eq(schema.stakeholders.id, stakeholderId),
        eq(schema.stakeholders.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!stakeholder) {
    throw errors.validation("Stakeholder tidak ditemukan atau tidak aktif.");
  }

  const taxonomy = {
    contentType: input.contentType ?? null,
    mainTheme: input.mainTheme ?? null,
    subTheme: input.subTheme ?? null,
  };
  const edufast =
    input.action === "SUBMIT" && input.mainTheme === "EDUFAST"
      ? await assertEdufastSelection({
          dateCreated: input.dateCreated,
          mainTheme: input.mainTheme,
          subTheme: input.subTheme ?? "",
        })
      : { policyId: null, policyVersion: null };

  let normalized: { normalizedUrl: string; normalizedUrlHash: string };
  try {
    normalized = normalizePublishedUrl(input.publishedUrl);
  } catch {
    throw errors.validation("Tautan harus berupa URL https yang valid.", [
      { path: "publishedUrl", message: "Format tautan tidak valid." },
    ]);
  }

  let existing: typeof schema.contentSubmissions.$inferSelect | undefined;
  if (input.submissionId) {
    const [row] = await db
      .select()
      .from(schema.contentSubmissions)
      .where(
        and(
          eq(schema.contentSubmissions.id, input.submissionId),
          eq(schema.contentSubmissions.createdBy, user.id),
        ),
      )
      .limit(1);

    if (!row) throw errors.notFound("Konten tidak ditemukan.");
    if (row.status !== "DRAFT" && row.status !== "REVISION_REQUIRED") {
      throw errors.conflict(
        "Konten ini sudah dikirim dan tidak dapat diubah. Muat ulang halaman untuk melihat status terbaru.",
        { status: row.status, version: row.version },
      );
    }
    existing = row;
  }

  const duplicateConditions: SQL[] = [
    eq(schema.contentSubmissions.normalizedUrlHash, normalized.normalizedUrlHash),
    ne(schema.contentSubmissions.status, "ARCHIVED"),
  ];
  if (existing) {
    duplicateConditions.push(ne(schema.contentSubmissions.id, existing.id));
  }

  const duplicateScope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  const [duplicate] = await db
    .select({
      id: schema.contentSubmissions.id,
      referenceCode: schema.contentSubmissions.referenceCode,
      status: schema.contentSubmissions.status,
      stakeholderName: schema.stakeholders.name,
      inScope: duplicateScope
        ? sql<boolean>`case when ${duplicateScope} then true else false end`
        : sql<boolean>`true`,
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(and(...duplicateConditions))
    .limit(1);

  if (duplicate && input.action === "SUBMIT" && !input.duplicateAcknowledged) {
    throw new AppError(
      "DUPLICATE_URL",
      duplicateMessage(duplicate),
      409,
      duplicateDetails(duplicate),
    );
  }

  const narrative = input.narrative ?? "";
  const title = input.title?.trim() || null;
  const publishedAt = input.publishedAt ?? null;
  const now = new Date();

  if (existing) {
    const isResubmission = existing.status === "REVISION_REQUIRED";
    const nextVersion = input.action === "SUBMIT" && isResubmission ? existing.version + 1 : existing.version;
    const nextStatus: ContentStatus =
      input.action === "SUBMIT"
        ? isResubmission
          ? "RESUBMITTED"
          : "SUBMITTED"
        : (existing.status as ContentStatus);

    try {
      await db.transaction(async (tx) => {
        const locationId = input.location
          ? await insertLocation(tx, input.location, `${stakeholder.name} — lokasi konten`)
          : existing!.locationId;

        const [updated] = await tx
          .update(schema.contentSubmissions)
          .set({
            title,
            narrative,
            publishedUrl: input.publishedUrl,
            normalizedUrl: normalized.normalizedUrl,
            normalizedUrlHash: normalized.normalizedUrlHash,
            platform: input.platform,
            themeId: input.themeId ?? null,
            contentType: taxonomy.contentType,
            mainTheme: taxonomy.mainTheme,
            subTheme: taxonomy.subTheme,
            edufastPolicyId: edufast.policyId,
            edufastPolicyVersion: edufast.policyVersion,
            resubmissionCount: isResubmission
              ? existing!.resubmissionCount + 1
              : existing!.resubmissionCount,
            dateCreated: input.dateCreated,
            publishedAt,
            locationId,
            status: nextStatus,
            version: nextVersion,
            idempotencyKey: input.idempotencyKey,
            submittedAt: input.action === "SUBMIT" ? now : existing!.submittedAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.contentSubmissions.id, existing!.id),
              eq(schema.contentSubmissions.createdBy, user.id),
              inArray(schema.contentSubmissions.status, ["DRAFT", "REVISION_REQUIRED"]),
            ),
          )
          .returning();

        if (!updated) {
          throw errors.conflict(
            "Status konten berubah saat penyimpanan. Muat ulang halaman lalu coba lagi.",
          );
        }

        if (input.action === "SUBMIT") {
          await tx
            .insert(schema.contentRevisions)
            .values({
              submissionId: updated.id,
              version: nextVersion,
              snapshot: snapshotFor({
                title,
                narrative,
                publishedUrl: input.publishedUrl,
                platform: input.platform,
                themeId: input.themeId ?? null,
                contentType: taxonomy.contentType,
                mainTheme: taxonomy.mainTheme,
                subTheme: taxonomy.subTheme,
                dateCreated: input.dateCreated,
                publishedAt,
                location: input.location ?? null,
              }),
              actorId: user.id,
              reason: isResubmission
                ? "Kirim ulang setelah permintaan revisi."
                : "Pengiriman untuk validasi.",
            })
            .onConflictDoNothing();

          await notifyAdmins(tx, {
            submissionId: updated.id,
            referenceCode: updated.referenceCode,
            stakeholderName: stakeholder.name,
            title: updated.title,
            version: updated.version,
            branchOfficeId: stakeholder.branchOfficeId ?? null,
            organizationId: stakeholder.id,
          });
        }

        await tx.insert(schema.auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: input.action === "SUBMIT" ? "CONTENT_SUBMITTED" : "CONTENT_DRAFT_SAVED",
          recordType: "CONTENT_SUBMISSION",
          recordId: updated.id,
          before: { status: existing!.status, version: existing!.version },
          after: {
            status: updated.status,
            version: updated.version,
            referenceCode: updated.referenceCode,
            stakeholderId: updated.stakeholderId,
          },
          requestId: requestId ?? null,
        });
      });

      if (input.action === "SUBMIT") {
        await drainOutbox().catch((error) => {
          console.error("[notifications] drain pasca-kirim gagal", error);
        });
      }

      const [fresh] = await db
        .select()
        .from(schema.contentSubmissions)
        .where(eq(schema.contentSubmissions.id, existing.id))
        .limit(1);

      if (!fresh) throw errors.server("Konten tidak dapat dimuat setelah disimpan.");
      return toSaved(fresh);
    } catch (error) {
      const [retryMatch] = await db
        .select()
        .from(schema.contentSubmissions)
        .where(
          and(
            eq(schema.contentSubmissions.id, existing.id),
            eq(schema.contentSubmissions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (retryMatch) return toSaved(retryMatch);
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const referenceCode = generateReferenceCode(now);
    const status: ContentStatus = input.action === "SUBMIT" ? "SUBMITTED" : "DRAFT";

    try {
      const created = await db.transaction(async (tx) => {
        const locationId = input.location
          ? await insertLocation(tx, input.location, `${stakeholder.name} — lokasi konten`)
          : await insertRegisteredPlaceholderLocation(tx, stakeholder);

        const [row] = await tx
          .insert(schema.contentSubmissions)
          .values({
            referenceCode,
            stakeholderId: stakeholder.id,
            createdBy: user.id,
            submittedBy: user.id,
            onBehalfOf: null,
            title,
            narrative,
            publishedUrl: input.publishedUrl,
            normalizedUrl: normalized.normalizedUrl,
            normalizedUrlHash: normalized.normalizedUrlHash,
            platform: input.platform,
            themeId: input.themeId ?? null,
            contentType: taxonomy.contentType,
            mainTheme: taxonomy.mainTheme,
            subTheme: taxonomy.subTheme,
            edufastPolicyId: edufast.policyId,
            edufastPolicyVersion: edufast.policyVersion,
            dateCreated: input.dateCreated,
            publishedAt,
            locationId,
            status,
            version: 1,
            idempotencyKey: input.idempotencyKey,
            submittedAt: input.action === "SUBMIT" ? now : null,
            archived: false,
            isDemo: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!row) throw errors.server("Konten tidak dapat disimpan.");

        if (input.action === "SUBMIT") {
          await tx.insert(schema.contentRevisions).values({
            submissionId: row.id,
            version: 1,
            snapshot: snapshotFor({
              title,
              narrative,
              publishedUrl: input.publishedUrl,
              platform: input.platform,
              themeId: input.themeId ?? null,
              contentType: taxonomy.contentType,
              mainTheme: taxonomy.mainTheme,
              subTheme: taxonomy.subTheme,
              dateCreated: input.dateCreated,
              publishedAt,
              location: input.location ?? null,
            }),
            actorId: user.id,
            reason: "Pengiriman untuk validasi.",
          });

          await notifyAdmins(tx, {
            submissionId: row.id,
            referenceCode,
            stakeholderName: stakeholder.name,
            title,
            version: 1,
            branchOfficeId: stakeholder.branchOfficeId ?? null,
            organizationId: stakeholder.id,
          });
        }

        await tx.insert(schema.auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: input.action === "SUBMIT" ? "CONTENT_SUBMITTED" : "CONTENT_DRAFT_SAVED",
          recordType: "CONTENT_SUBMISSION",
          recordId: row.id,
          before: null,
          after: {
            status: row.status,
            version: row.version,
            referenceCode: row.referenceCode,
            stakeholderId: row.stakeholderId,
          },
          requestId: requestId ?? null,
        });

        return row;
      });

      if (input.action === "SUBMIT") {
        await drainOutbox().catch((error) => {
          console.error("[notifications] drain pasca-kirim gagal", error);
        });
      }

      return toSaved(created, true);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [retryMatch] = await db
          .select()
          .from(schema.contentSubmissions)
          .where(
            and(
              eq(schema.contentSubmissions.createdBy, user.id),
              eq(schema.contentSubmissions.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (retryMatch) return toSaved(retryMatch);
        continue;
      }
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  throw errors.server("Nomor referensi tidak dapat dibuat. Silakan coba lagi.");
}
