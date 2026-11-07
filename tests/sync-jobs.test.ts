import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import {
  cancelSyncJob,
  recoverStaleJobs,
  retrySyncJob,
  runSyncJob,
  startSyncJob,
  syncProgress,
  SYNC_HEARTBEAT_TIMEOUT_MS,
  toSyncJobView,
  type SyncJobView,
} from "@/lib/sync/jobs";

const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
  "0004_v1_1_foundations.sql",
  "0005_v1_1_perf_indexes.sql",
  "0006_v1_2_imports_sync.sql",
];

const MASTER_ID = "sync-test-master";
const REGION_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";
const APPROVED_FIXED_ID = "55555555-5555-4555-8555-555555555555";
const APPROVED_DATED_ID = "66666666-6666-4666-8666-666666666666";
const ORPHAN_ID = "77777777-7777-4777-8777-777777777777";

const REVIEW_DATE = new Date("2026-10-09T03:00:00.000Z");

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

async function createJob(dryRun: boolean): Promise<SyncJobView> {
  return startSyncJob({
    actorId: MASTER_ID,
    dryRun,
    db: db as never,
  });
}

async function loadJob(id: string): Promise<SyncJobView> {
  const [row] = await db
    .select()
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.id, id));
  if (!row) throw new Error(`Sync job ${id} not found`);
  return toSyncJobView(row);
}

function insertSubmission(
  id: string,
  referenceCode: string,
  status: string,
  approvedAt: Date | null,
): Promise<unknown> {
  return client.query(
    `insert into content_submissions
       (id, reference_code, stakeholder_id, created_by, submitted_by, title, narrative,
        published_url, normalized_url, normalized_url_hash, platform, date_created,
        location_id, branch_office_id, regional_office_id, status, idempotency_key,
        submitted_at, approved_at)
     values
       ($1::uuid, $2, $3::uuid, $4, $4, $2, 'Narasi uji sinkronisasi internal',
        $5, $5, $6, 'INSTAGRAM', '2026-10-01',
        $7::uuid, $8::uuid, $9::uuid, $10, $2, now(), $11)`,
    [
      id,
      referenceCode,
      ORG_ID,
      MASTER_ID,
      `https://www.instagram.com/p/${referenceCode}`,
      createHash("sha256")
        .update(`https://www.instagram.com/p/${referenceCode}`)
        .digest("hex"),
      LOCATION_ID,
      BRANCH_ID,
      REGION_ID,
      status,
      approvedAt,
    ],
  );
}

beforeAll(async () => {
  client = new PGlite();
  for (const file of MIGRATIONS) {
    await client.exec(
      readFileSync(join(process.cwd(), "drizzle", file), "utf8"),
    );
  }

  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
     values ($1, 'Sync Master', 'sync-master@example.test', true, 'admin', now(), now())`,
    [MASTER_ID],
  );

  await client.query(
    `insert into regional_offices (id, code, name, status)
     values ($1::uuid, 'REG-SYNC', 'Wilayah Sinkronisasi', 'ACTIVE')`,
    [REGION_ID],
  );

  await client.query(
    `insert into branch_offices (id, regional_office_id, code, name, status)
     values ($1::uuid, $2::uuid, 'CBG-SYNC', 'Cabang Sinkronisasi', 'ACTIVE')`,
    [BRANCH_ID, REGION_ID],
  );

  await client.query(
    `insert into stakeholders
       (id, name, category, organization_type, faskes_class, faskes_code,
        faskes_code_normalized, service_area, latitude, longitude, status, joined_at,
        branch_office_id)
     values ($1::uuid, 'Klinik Sinkron', 'FASKES', 'FASKES', 'FKTP', 'FKTP-SYNC',
        'fktp-sync', 'Bandung', -6.9, 107.6, 'ACTIVE', '2026-01-01', $2::uuid)`,
    [ORG_ID, BRANCH_ID],
  );

  await client.query(
    `insert into locations (id, latitude, longitude, label, source, verified_status, precision)
     values ($1::uuid, -6.9, 107.6, 'Lokasi sinkron', 'manual_pin', 'MANUAL_UNVERIFIED', 'approximate')`,
    [LOCATION_ID],
  );

  await insertSubmission(APPROVED_FIXED_ID, "DAK-SYNC-FIXED", "APPROVED", null);
  await insertSubmission(
    APPROVED_DATED_ID,
    "DAK-SYNC-DATED",
    "APPROVED",
    new Date("2026-10-05T02:00:00.000Z"),
  );
  await insertSubmission(
    ORPHAN_ID,
    "DAK-SYNC-ORPHAN",
    "SUBMITTED",
    new Date("2026-10-06T02:00:00.000Z"),
  );

  await client.query(
    `insert into content_reviews
       (submission_id, version, reviewer_id, action, checklist, notes,
        previous_status, next_status, created_at)
     values ($1::uuid, 1, $2, 'APPROVE', '{"relevansiTema": true}'::jsonb,
        'Disetujui untuk uji', 'SUBMITTED', 'APPROVED', $3)`,
    [APPROVED_FIXED_ID, MASTER_ID, REVIEW_DATE],
  );

  await client.query(
    `insert into outbox_events (event_key, aggregate_type, aggregate_id, event_type, payload)
     values ('sync-test-event', 'CONTENT_SUBMISSION', $1, 'notification.created', '{}'::jsonb)`,
    [APPROVED_FIXED_ID],
  );

  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

describe("sync progress", () => {
  it("reports a bounded percentage only when the total is known", () => {
    expect(syncProgress(0, null)).toBeNull();
    expect(syncProgress(5, 0)).toBeNull();
    expect(syncProgress(50, 200)).toBe(25);
    expect(syncProgress(400, 200)).toBe(100);
    expect(syncProgress(-5, 200)).toBe(0);
  });
});

describe("sync job lifecycle", () => {
  it("rejects a second active job of the same kind", async () => {
    const job = await createJob(true);
    expect(job.status).toBe("QUEUED");

    await expect(createJob(true)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const cancelled = await cancelSyncJob(job.id, db as never);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("runs a dry-run without mutating data and reports findings", async () => {
    const job = await createJob(true);
    await runSyncJob(job.id, db as never);

    const view = await loadJob(job.id);
    expect(view.status).toBe("COMPLETED");
    expect(view.processed).toBe(view.total);
    expect(view.total).toBeGreaterThan(0);
    expect(view.summary?.dryRun).toBe(true);
    expect(view.summary?.hasFindings).toBe(true);
    expect(view.summary?.externalConnectors).toBe("BLOCKED");
    expect(
      view.summary?.stages.some(
        (stage) => stage.stage === "APPROVAL_INVARIANTS" && stage.findings > 0,
      ),
    ).toBe(true);

    const [approval] = await db
      .select({ approvedAt: schema.contentSubmissions.approvedAt })
      .from(schema.contentSubmissions)
      .where(eq(schema.contentSubmissions.id, APPROVED_FIXED_ID));
    expect(approval?.approvedAt).toBeNull();

    const [outbox] = await db
      .select({ processedAt: schema.outboxEvents.processedAt })
      .from(schema.outboxEvents);
    expect(outbox?.processedAt).toBeNull();
  });

  it("stops at the next batch boundary when cancellation is requested", async () => {
    const job = await createJob(true);
    await db
      .update(schema.syncJobs)
      .set({ cancelRequested: true })
      .where(eq(schema.syncJobs.id, job.id));

    await runSyncJob(job.id, db as never);

    const [row] = await db
      .select()
      .from(schema.syncJobs)
      .where(eq(schema.syncJobs.id, job.id));
    expect(row?.status).toBe("CANCELLED");
    expect(row?.processed).toBe(0);
  });

  it("recovers a stale running job and allows a retry", async () => {
    const job = await createJob(true);
    await db
      .update(schema.syncJobs)
      .set({
        status: "RUNNING",
        startedAt: new Date(Date.now() - SYNC_HEARTBEAT_TIMEOUT_MS * 3),
        heartbeatAt: new Date(Date.now() - SYNC_HEARTBEAT_TIMEOUT_MS * 3),
      })
      .where(eq(schema.syncJobs.id, job.id));

    const recovered = await recoverStaleJobs(db as never);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const [failed] = await db
      .select()
      .from(schema.syncJobs)
      .where(eq(schema.syncJobs.id, job.id));
    expect(failed?.status).toBe("FAILED");

    const retried = await retrySyncJob({
      id: job.id,
      actorId: MASTER_ID,
      db: db as never,
    });
    expect(retried.status).toBe("QUEUED");
    expect(retried.dryRun).toBe(true);
    expect(retried.id).not.toBe(job.id);

    await cancelSyncJob(retried.id, db as never);
  });

  it("applies the sanctioned approval fix and drains the outbox", async () => {
    const job = await createJob(false);
    await runSyncJob(job.id, db as never);

    const view = await loadJob(job.id);
    expect(view.status).toBe("PARTIAL");
    expect(view.summary?.dryRun).toBe(false);

    const approvalStage = view.summary?.stages.find(
      (stage) => stage.stage === "APPROVAL_INVARIANTS",
    );
    expect(approvalStage?.fixed).toBe(1);

    const [approval] = await db
      .select({ approvedAt: schema.contentSubmissions.approvedAt })
      .from(schema.contentSubmissions)
      .where(eq(schema.contentSubmissions.id, APPROVED_FIXED_ID));
    expect(approval?.approvedAt?.toISOString()).toBe(REVIEW_DATE.toISOString());

    const [outbox] = await db
      .select({
        processedAt: schema.outboxEvents.processedAt,
        attempts: schema.outboxEvents.attempts,
      })
      .from(schema.outboxEvents);
    expect(outbox?.processedAt).not.toBeNull();
    expect(outbox?.attempts).toBe(1);
  });

  it("is idempotent on a second apply run", async () => {
    const job = await createJob(false);
    await runSyncJob(job.id, db as never);

    const view = await loadJob(job.id);
    const approvalStage = view.summary?.stages.find(
      (stage) => stage.stage === "APPROVAL_INVARIANTS",
    );
    expect(approvalStage?.findings).toBe(1);
    expect(approvalStage?.fixed).toBe(0);

    const outboxStage = view.summary?.stages.find(
      (stage) => stage.stage === "OUTBOX_DRAIN",
    );
    expect(outboxStage?.fixed).toBe(0);
  });
});
