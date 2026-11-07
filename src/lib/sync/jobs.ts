import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import { approvedContentCondition } from "@/lib/analytics/approved";
import { errors } from "@/lib/errors";
import { monthKeyFor, monthRange } from "@/lib/kpi/formulas";
import { cachedRead, invalidateReadCache } from "@/lib/read-cache";
import {
  SYNC_KIND,
  SYNC_STAGES,
  SYNC_STAGE_LABELS,
  type SyncJobView,
  type SyncStage,
  type SyncStageReport,
  type SyncStatus,
  type SyncSummary,
  type SyncWorkStage,
} from "@/lib/sync/shared";

export {
  SYNC_KIND,
  SYNC_STAGES,
  SYNC_STAGE_LABELS,
  type SyncJobView,
  type SyncStage,
  type SyncStageReport,
  type SyncStatus,
  type SyncSummary,
  type SyncWorkStage,
} from "@/lib/sync/shared";

export const SYNC_CHUNK_SIZE = 200;
export const SYNC_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;
export const SYNC_QUEUED_TIMEOUT_MS = 5 * 60 * 1000;
export const SYNC_MAX_ATTEMPTS = 3;

export type SyncDb = ReturnType<typeof getDb>;
type SyncJobRow = typeof schema.syncJobs.$inferSelect;

export function syncProgress(
  processed: number,
  total: number | null,
): number | null {
  if (total === null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

export function toSyncJobView(row: SyncJobRow): SyncJobView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status as SyncStatus,
    dryRun: row.dryRun,
    stage: row.stage as SyncStage,
    processed: row.processed,
    total: row.total,
    percent: syncProgress(row.processed, row.total),
    summary: (row.summary ?? null) as SyncSummary | null,
    error: row.error,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    heartbeatAt: row.heartbeatAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    cancelRequested: row.cancelRequested,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(work: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt < SYNC_MAX_ATTEMPTS) await sleep(150 * attempt);
    }
  }
  throw lastError;
}

export async function startSyncJob(input: {
  actorId: string;
  dryRun?: boolean;
  db?: SyncDb;
}): Promise<SyncJobView> {
  const db = input.db ?? getDb();
  try {
    const [row] = await db
      .insert(schema.syncJobs)
      .values({
        kind: SYNC_KIND,
        status: "QUEUED",
        dryRun: input.dryRun ?? true,
        stage: "QUEUED",
        createdBy: input.actorId,
      })
      .returning();
    if (!row) throw errors.server("Pekerjaan sinkronisasi tidak dapat dibuat.");
    return toSyncJobView(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict(
        "Sinkronisasi lain masih berjalan. Tunggu sampai selesai sebelum memulai yang baru.",
      );
    }
    throw error;
  }
}

/**
 * A worker that stops heartbeating cannot finish its job: the partial unique
 * index would block every future sync, so stale rows are failed on read.
 */
export async function recoverStaleJobs(db: SyncDb = getDb()): Promise<number> {
  const now = Date.now();
  const recovered = await db
    .update(schema.syncJobs)
    .set({
      status: "FAILED",
      error: sql`case
        when ${schema.syncJobs.status} = 'RUNNING'
          then 'Pekerjaan berhenti tanpa heartbeat. Jalankan ulang sinkronisasi.'
        else 'Pekerjaan tidak pernah mulai. Jalankan ulang sinkronisasi.'
      end`,
      finishedAt: new Date(now),
    })
    .where(
      or(
        and(
          eq(schema.syncJobs.status, "RUNNING"),
          or(
            isNull(schema.syncJobs.heartbeatAt),
            lte(
              schema.syncJobs.heartbeatAt,
              new Date(now - SYNC_HEARTBEAT_TIMEOUT_MS),
            ),
          ),
        ),
        and(
          eq(schema.syncJobs.status, "QUEUED"),
          lte(
            schema.syncJobs.createdAt,
            new Date(now - SYNC_QUEUED_TIMEOUT_MS),
          ),
        ),
      ),
    )
    .returning({ id: schema.syncJobs.id });

  return recovered.length;
}

export async function listSyncJobs(
  limit = 10,
  db: SyncDb = getDb(),
): Promise<SyncJobView[]> {
  await recoverStaleJobs(db);
  const rows = await db
    .select()
    .from(schema.syncJobs)
    .orderBy(desc(schema.syncJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map(toSyncJobView);
}

export async function getSyncJob(
  id: string,
  db: SyncDb = getDb(),
): Promise<SyncJobView> {
  await recoverStaleJobs(db);
  const [row] = await db
    .select()
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.id, id))
    .limit(1);
  if (!row) throw errors.notFound("Pekerjaan sinkronisasi tidak ditemukan.");
  return toSyncJobView(row);
}

export async function cancelSyncJob(
  id: string,
  db: SyncDb = getDb(),
): Promise<SyncJobView> {
  const [row] = await db
    .select()
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.id, id))
    .limit(1);
  if (!row) throw errors.notFound("Pekerjaan sinkronisasi tidak ditemukan.");
  if (row.status !== "QUEUED" && row.status !== "RUNNING") {
    throw errors.conflict(
      "Pekerjaan ini sudah selesai dan tidak dapat dibatalkan.",
    );
  }

  const [updated] = await db
    .update(schema.syncJobs)
    .set(
      row.status === "QUEUED"
        ? {
            cancelRequested: true,
            status: "CANCELLED",
            finishedAt: new Date(),
            stage: row.stage,
          }
        : { cancelRequested: true },
    )
    .where(eq(schema.syncJobs.id, id))
    .returning();
  if (!updated) throw errors.server("Status pembatalan tidak dapat disimpan.");
  return toSyncJobView(updated);
}

export async function retrySyncJob(input: {
  id: string;
  actorId: string;
  db?: SyncDb;
}): Promise<SyncJobView> {
  const db = input.db ?? getDb();
  const [row] = await db
    .select()
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.id, input.id))
    .limit(1);
  if (!row) throw errors.notFound("Pekerjaan sinkronisasi tidak ditemukan.");
  if (!["FAILED", "PARTIAL", "CANCELLED"].includes(row.status)) {
    throw errors.conflict(
      "Hanya pekerjaan gagal, sebagian, atau dibatalkan yang dapat dijalankan ulang.",
    );
  }
  return startSyncJob({
    actorId: input.actorId,
    dryRun: row.dryRun,
    db,
  });
}

type RunContext = {
  db: SyncDb;
  jobId: string;
  dryRun: boolean;
  processed: number;
  total: number | null;
  units: Record<SyncWorkStage, number>;
};

function reportFor(stage: SyncWorkStage): SyncStageReport {
  return {
    stage,
    label: SYNC_STAGE_LABELS[stage],
    scanned: 0,
    findings: 0,
    fixed: 0,
    notes: [],
  };
}

async function persistProgress(
  ctx: RunContext,
  stage: SyncWorkStage,
  advance: number,
): Promise<void> {
  ctx.processed += Math.max(advance, 0);
  await ctx.db
    .update(schema.syncJobs)
    .set({
      stage,
      processed: ctx.processed,
      total: ctx.total,
      heartbeatAt: new Date(),
    })
    .where(eq(schema.syncJobs.id, ctx.jobId));
}

async function isCancelRequested(ctx: RunContext): Promise<boolean> {
  const [row] = await ctx.db
    .select({ cancelRequested: schema.syncJobs.cancelRequested })
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.id, ctx.jobId))
    .limit(1);
  return row?.cancelRequested ?? true;
}

async function planUnits(db: SyncDb): Promise<{
  units: Record<SyncWorkStage, number>;
  total: number;
}> {
  const [submissions] = await db
    .select({ value: count() })
    .from(schema.contentSubmissions);
  const [approved] = await db
    .select({ value: count() })
    .from(schema.contentSubmissions)
    .where(eq(schema.contentSubmissions.status, "APPROVED"));
  const [organizations] = await db
    .select({ value: count() })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.status, "ACTIVE"));
  const [pendingOutbox] = await db
    .select({ value: count() })
    .from(schema.outboxEvents)
    .where(
      and(
        isNull(schema.outboxEvents.processedAt),
        or(
          isNull(schema.outboxEvents.nextRetryAt),
          lte(schema.outboxEvents.nextRetryAt, new Date()),
        ),
      ),
    );

  const units: Record<SyncWorkStage, number> = {
    SCOPE_AUDIT: Number(submissions?.value ?? 0),
    APPROVAL_INVARIANTS: Number(approved?.value ?? 0),
    TARGET_RECONCILE: Number(organizations?.value ?? 0),
    CACHE_INVALIDATE: 1,
    OUTBOX_DRAIN: Number(pendingOutbox?.value ?? 0),
    ANALYTICS_WARM: 1,
  };
  const total = SYNC_STAGES.reduce((sum, stage) => sum + units[stage], 0);
  return { units, total };
}

async function runScopeAudit(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("SCOPE_AUDIT");
  let cursor: string | null = null;
  let historicalMismatch = 0;

  for (;;) {
    if (await isCancelRequested(ctx)) return { report, cancelled: true };
    const rows = await withRetry(() =>
      ctx.db
        .select({
          id: schema.contentSubmissions.id,
          branchOfficeId: schema.contentSubmissions.branchOfficeId,
          regionalOfficeId: schema.contentSubmissions.regionalOfficeId,
          orgBranchId: schema.stakeholders.branchOfficeId,
          orgRegionalId: schema.branchOffices.regionalOfficeId,
        })
        .from(schema.contentSubmissions)
        .leftJoin(
          schema.stakeholders,
          eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
        )
        .leftJoin(
          schema.branchOffices,
          eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
        )
        .where(cursor ? gt(schema.contentSubmissions.id, cursor) : undefined)
        .orderBy(asc(schema.contentSubmissions.id))
        .limit(SYNC_CHUNK_SIZE),
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.branchOfficeId && row.orgBranchId) {
        report.findings += 1;
        if (report.notes.length < 3) {
          report.notes.push(
            `Snapshot cabang kosong pada konten ${row.id.slice(0, 8)} padahal organisasi memiliki cabang.`,
          );
        }
      }
      if (!row.regionalOfficeId && row.orgRegionalId) {
        report.findings += 1;
        if (report.notes.length < 5) {
          report.notes.push(
            `Snapshot wilayah kosong pada konten ${row.id.slice(0, 8)} padahal organisasi memiliki wilayah.`,
          );
        }
      }
      if (
        (row.branchOfficeId &&
          row.orgBranchId &&
          row.branchOfficeId !== row.orgBranchId) ||
        (row.regionalOfficeId &&
          row.orgRegionalId &&
          row.regionalOfficeId !== row.orgRegionalId)
      ) {
        historicalMismatch += 1;
      }
    }

    cursor = rows[rows.length - 1]!.id;
    report.scanned += rows.length;
    await persistProgress(ctx, "SCOPE_AUDIT", rows.length);
  }

  if (historicalMismatch > 0) {
    report.notes.push(
      `${historicalMismatch} konten memakai snapshot cabang/wilayah historis yang berbeda dari data organisasi saat ini. Snapshot dipertahankan agar cakupan lampau tetap stabil.`,
    );
  }
  return { report, cancelled: false };
}

async function runApprovalInvariants(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("APPROVAL_INVARIANTS");
  let cursor: string | null = null;

  const [orphanApproval] = await ctx.db
    .select({ value: count() })
    .from(schema.contentSubmissions)
    .where(
      and(
        sql`${schema.contentSubmissions.status} <> 'APPROVED'`,
        sql`${schema.contentSubmissions.approvedAt} is not null`,
      ),
    );
  const orphanCount = Number(orphanApproval?.value ?? 0);

  for (;;) {
    if (await isCancelRequested(ctx)) return { report, cancelled: true };
    const rows = await withRetry(() =>
      ctx.db
        .select({
          id: schema.contentSubmissions.id,
          approvedAt: schema.contentSubmissions.approvedAt,
          firstSubmittedAt: schema.contentSubmissions.firstSubmittedAt,
          submittedAt: schema.contentSubmissions.submittedAt,
          createdAt: schema.contentSubmissions.createdAt,
        })
        .from(schema.contentSubmissions)
        .where(
          and(
            eq(schema.contentSubmissions.status, "APPROVED"),
            cursor ? gt(schema.contentSubmissions.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(schema.contentSubmissions.id))
        .limit(SYNC_CHUNK_SIZE),
    );
    if (rows.length === 0) break;

    const missing = rows.filter((row) => row.approvedAt === null);
    if (missing.length > 0) {
      report.findings += missing.length;
      if (ctx.dryRun) {
        if (report.notes.length < 3) {
          report.notes.push(
            `${missing.length} konten disetujui tanpa timestamp persetujuan pada batch ini. Jalankan mode terapkan untuk mengisi dari riwayat review.`,
          );
        }
      } else {
        const reviewRows = await withRetry(() =>
          ctx.db
            .select({
              submissionId: schema.contentReviews.submissionId,
              createdAt: schema.contentReviews.createdAt,
            })
            .from(schema.contentReviews)
            .where(
              and(
                inArray(
                  schema.contentReviews.submissionId,
                  missing.map((row) => row.id),
                ),
                eq(schema.contentReviews.action, "APPROVE"),
              ),
            )
            .orderBy(desc(schema.contentReviews.createdAt)),
        );
        const reviewDate = new Map<string, Date>();
        for (const review of reviewRows) {
          if (!reviewDate.has(review.submissionId)) {
            reviewDate.set(review.submissionId, review.createdAt);
          }
        }
        for (const row of missing) {
          const approvedAt =
            reviewDate.get(row.id) ??
            row.firstSubmittedAt ??
            row.submittedAt ??
            row.createdAt;
          await withRetry(() =>
            ctx.db
              .update(schema.contentSubmissions)
              .set({ approvedAt })
              .where(eq(schema.contentSubmissions.id, row.id)),
          );
          report.fixed += 1;
        }
      }
    }

    cursor = rows[rows.length - 1]!.id;
    report.scanned += rows.length;
    await persistProgress(ctx, "APPROVAL_INVARIANTS", rows.length);
  }

  if (orphanCount > 0) {
    report.findings += orphanCount;
    report.notes.push(
      `${orphanCount} konten non-aktif masih menyimpan timestamp persetujuan lama. Tidak diubah otomatis agar riwayat keputusan tetap utuh.`,
    );
  }
  return { report, cancelled: false };
}

async function runTargetReconcile(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("TARGET_RECONCILE");
  if (await isCancelRequested(ctx)) return { report, cancelled: true };

  const range = monthRange(monthKeyFor());
  const [active] = await ctx.db
    .select({ value: count() })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.status, "ACTIVE"));
  const activeCount = Number(active?.value ?? 0);

  const missing = await withRetry(() =>
    ctx.db
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .leftJoin(
        schema.kpiTargets,
        and(
          eq(schema.kpiTargets.stakeholderId, schema.stakeholders.id),
          eq(schema.kpiTargets.periodStart, range.startLocal),
          eq(schema.kpiTargets.periodEnd, range.endLocal),
          isNull(schema.kpiTargets.regionalOfficeId),
          isNull(schema.kpiTargets.branchOfficeId),
          isNull(schema.kpiTargets.themeId),
          isNull(schema.kpiTargets.subTheme),
        ),
      )
      .where(
        and(
          eq(schema.stakeholders.status, "ACTIVE"),
          isNull(schema.kpiTargets.id),
        ),
      ),
  );

  report.scanned = activeCount;
  report.findings = missing.length;
  if (missing.length > 0) {
    report.notes.push(
      `${missing.length} organisasi aktif belum memiliki target level organisasi untuk ${range.key}. Target tidak dibuat otomatis karena mengubah penyebut capaian; lengkapi melalui halaman Target.`,
    );
  }
  await persistProgress(ctx, "TARGET_RECONCILE", activeCount);
  return { report, cancelled: false };
}

async function runCacheInvalidate(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("CACHE_INVALIDATE");
  if (await isCancelRequested(ctx)) return { report, cancelled: true };
  report.scanned = 1;
  if (ctx.dryRun) {
    report.notes.push("Dry-run: cache aplikasi tidak dibersihkan.");
  } else {
    invalidateReadCache();
    report.notes.push("Cache baca aplikasi dibersihkan.");
  }
  await persistProgress(ctx, "CACHE_INVALIDATE", 1);
  return { report, cancelled: false };
}

async function runOutboxDrain(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("OUTBOX_DRAIN");
  const limit = ctx.units.OUTBOX_DRAIN;

  for (let scanned = 0; scanned < limit;) {
    if (await isCancelRequested(ctx)) return { report, cancelled: true };
    const now = new Date();
    const pending = await withRetry(() =>
      ctx.db
        .select({ id: schema.outboxEvents.id })
        .from(schema.outboxEvents)
        .where(
          and(
            isNull(schema.outboxEvents.processedAt),
            or(
              isNull(schema.outboxEvents.nextRetryAt),
              lte(schema.outboxEvents.nextRetryAt, now),
            ),
          ),
        )
        .orderBy(asc(schema.outboxEvents.createdAt))
        .limit(Math.min(SYNC_CHUNK_SIZE, limit - scanned)),
    );
    if (pending.length === 0) break;

    if (!ctx.dryRun) {
      await withRetry(() =>
        ctx.db
          .update(schema.outboxEvents)
          .set({
            processedAt: now,
            attempts: sql`${schema.outboxEvents.attempts} + 1`,
            lastError: null,
          })
          .where(
            inArray(
              schema.outboxEvents.id,
              pending.map((row) => row.id),
            ),
          ),
      );
      report.fixed += pending.length;
    }

    scanned += pending.length;
    report.scanned += pending.length;
    await persistProgress(ctx, "OUTBOX_DRAIN", pending.length);
  }

  if (ctx.dryRun && report.scanned > 0) {
    report.notes.push(
      `${report.scanned} peristiwa outbox tertunda; dry-run tidak menandainya terkirim.`,
    );
  }
  if (!ctx.dryRun && report.fixed > 0) {
    report.notes.push(`${report.fixed} peristiwa outbox ditandai terkirim.`);
  }
  return { report, cancelled: false };
}

async function runAnalyticsWarm(
  ctx: RunContext,
): Promise<{ report: SyncStageReport; cancelled: boolean }> {
  const report = reportFor("ANALYTICS_WARM");
  if (await isCancelRequested(ctx)) return { report, cancelled: true };

  const monthly = await withRetry(() =>
    cachedRead(
      JSON.stringify(["sync", "approved-monthly"]),
      () =>
        ctx.db
          .select({
            month: sql<string>`to_char(${schema.contentSubmissions.approvedAt} + interval '7 hours', 'YYYY-MM')`,
            total: count(),
          })
          .from(schema.contentSubmissions)
          .where(approvedContentCondition())
          .groupBy(
            sql`to_char(${schema.contentSubmissions.approvedAt} + interval '7 hours', 'YYYY-MM')`,
          )
          .orderBy(
            sql`to_char(${schema.contentSubmissions.approvedAt} + interval '7 hours', 'YYYY-MM')`,
          ),
      { ttlMs: 60_000, maxStaleMs: 60_000 },
    ),
  );

  report.scanned = monthly.length;
  report.notes.push(
    monthly.length > 0
      ? `Agregat bulanan konten disetujui disiapkan untuk ${monthly.length} bulan.`
      : "Belum ada konten disetujui; agregat bulanan kosong tetap disiapkan.",
  );
  await persistProgress(ctx, "ANALYTICS_WARM", 1);
  return { report, cancelled: false };
}

const STAGE_RUNNERS: Record<
  SyncWorkStage,
  (ctx: RunContext) => Promise<{ report: SyncStageReport; cancelled: boolean }>
> = {
  SCOPE_AUDIT: runScopeAudit,
  APPROVAL_INVARIANTS: runApprovalInvariants,
  TARGET_RECONCILE: runTargetReconcile,
  CACHE_INVALIDATE: runCacheInvalidate,
  OUTBOX_DRAIN: runOutboxDrain,
  ANALYTICS_WARM: runAnalyticsWarm,
};

function buildSummary(
  dryRun: boolean,
  reports: SyncStageReport[],
): SyncSummary {
  const totals = reports.reduce(
    (acc, report) => ({
      scanned: acc.scanned + report.scanned,
      findings: acc.findings + report.findings,
      fixed: acc.fixed + report.fixed,
    }),
    { scanned: 0, findings: 0, fixed: 0 },
  );
  return {
    dryRun,
    hasFindings: totals.findings > 0,
    stages: reports,
    totals,
    externalConnectors: "BLOCKED",
    externalNote:
      "Tidak ada konektor data eksternal pada lingkungan ini. Sinkronisasi hanya menjalankan pemeriksaan internal.",
  };
}

/**
 * Runs one queued job to completion. Claiming is atomic so a duplicated
 * invocation (retry after deploy, double `after()` scheduling) cannot run the
 * same job twice. Dry-run is the default and mutates nothing.
 */
export async function runSyncJob(
  jobId: string,
  db: SyncDb = getDb(),
): Promise<void> {
  const [claimed] = await db
    .update(schema.syncJobs)
    .set({
      status: "RUNNING",
      stage: "SCOPE_AUDIT",
      startedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .where(
      and(eq(schema.syncJobs.id, jobId), eq(schema.syncJobs.status, "QUEUED")),
    )
    .returning();
  if (!claimed) return;

  const reports: SyncStageReport[] = [];

  try {
    const plan = await planUnits(db);
    const ctx: RunContext = {
      db,
      jobId,
      dryRun: claimed.dryRun,
      processed: 0,
      total: plan.total,
      units: plan.units,
    };
    await db
      .update(schema.syncJobs)
      .set({ total: plan.total, heartbeatAt: new Date() })
      .where(eq(schema.syncJobs.id, jobId));

    for (const stage of SYNC_STAGES) {
      const { report, cancelled } = await STAGE_RUNNERS[stage](ctx);
      reports.push(report);
      if (cancelled) {
        await db
          .update(schema.syncJobs)
          .set({
            status: "CANCELLED",
            stage,
            processed: ctx.processed,
            total: ctx.total,
            summary: buildSummary(claimed.dryRun, reports),
            heartbeatAt: new Date(),
            finishedAt: new Date(),
          })
          .where(eq(schema.syncJobs.id, jobId));
        return;
      }
    }

    const summary = buildSummary(claimed.dryRun, reports);
    const hasUnfixedFindings = !claimed.dryRun
      ? reports.some((report) => report.findings > report.fixed)
      : false;

    await db
      .update(schema.syncJobs)
      .set({
        status: hasUnfixedFindings ? "PARTIAL" : "COMPLETED",
        stage: SYNC_STAGES[SYNC_STAGES.length - 1],
        processed: ctx.total ?? ctx.processed,
        total: ctx.total,
        summary,
        error: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncJobs.id, jobId));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Sinkronisasi gagal.";
    await db
      .update(schema.syncJobs)
      .set({
        status: "FAILED",
        error: message,
        summary: buildSummary(claimed.dryRun, reports),
        heartbeatAt: new Date(),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncJobs.id, jobId));
  }
}
