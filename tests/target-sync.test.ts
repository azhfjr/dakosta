import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import {
  getTargetSyncPreview,
  syncTargets,
  type TargetDb,
} from "@/lib/targets/sync";

const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
  "0004_v1_1_foundations.sql",
];

const MONTH = "2026-10";
const ACTOR_ID = "master-sync-test";

const ORGANIZATIONS = [
  { id: "org-fktp-1", type: "FASKES", faskesClass: "FKTP", status: "ACTIVE" },
  { id: "org-fktp-2", type: "FASKES", faskesClass: "FKTP", status: "ACTIVE" },
  { id: "org-fkrtl-1", type: "FASKES", faskesClass: "FKRTL", status: "ACTIVE" },
  { id: "org-pemda-1", type: "PEMDA", faskesClass: null, status: "ACTIVE" },
  { id: "org-other-1", type: "OTHER", faskesClass: null, status: "ACTIVE" },
  {
    id: "org-fktp-old",
    type: "FASKES",
    faskesClass: "FKTP",
    status: "INACTIVE",
  },
];

let client: PGlite;
let db: TargetDb;

function uuidFor(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
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
     values ($1, 'Master Sync', 'master-sync@example.test', true, 'admin', now(), now())`,
    [ACTOR_ID],
  );

  for (const [index, organization] of ORGANIZATIONS.entries()) {
    await client.query(
      `insert into stakeholders
         (id, name, category, organization_type, faskes_class, faskes_code_normalized,
          service_area, latitude, longitude, status, joined_at)
       values ($1::uuid, $2, 'FASKES', $3, $4, $5, 'Kota Uji', -6.9, 107.6, $6, '2026-01-01')`,
      [
        uuidFor(index + 1),
        organization.id,
        organization.type,
        organization.faskesClass,
        organization.type === "FASKES" ? `kode-${index + 1}` : null,
        organization.status,
      ],
    );
  }

  db = drizzle(client, { schema }) as unknown as TargetDb;
});

afterAll(async () => {
  await client.close();
});

describe("target synchronization", () => {
  it("counts only active organizations per source", async () => {
    const preview = await getTargetSyncPreview(MONTH, db);
    const fktp = preview.sources.find(
      (source) => source.source === "FASKES_FKTP",
    );
    expect(fktp?.activeOrganizations).toBe(2);
    expect(fktp?.withTarget).toBe(0);
    expect(fktp?.missing).toBe(2);
    expect(preview.totalActiveOrganizations).toBe(5);
    expect(preview.sources.map((source) => source.source)).toEqual([
      "FASKES_FKTP",
      "FASKES_FKRTL",
      "PEMDA",
      "OTHER",
    ]);
  });

  it("creates one target per active organization and skips inactive ones", async () => {
    const result = await syncTargets({
      month: MONTH,
      actorId: ACTOR_ID,
      entries: [
        { source: "FASKES_FKTP", targetCount: 2 },
        { source: "FASKES_FKRTL", targetCount: 4 },
        { source: "PEMDA", targetCount: 1 },
        { source: "OTHER", targetCount: 1 },
      ],
      db,
    });

    expect(result.created).toBe(5);
    expect(result.updated).toBe(0);
    expect(
      result.perSource.find((row) => row.source === "FASKES_FKTP"),
    ).toMatchObject({
      targetCount: 2,
      organizations: 2,
      created: 2,
    });

    const rows = await db
      .select({
        stakeholderId: schema.kpiTargets.stakeholderId,
        targetCount: schema.kpiTargets.targetCount,
      })
      .from(schema.kpiTargets)
      .where(isNull(schema.kpiTargets.subTheme));
    expect(rows).toHaveLength(5);
    const targets = new Map(
      rows.map((row) => [row.stakeholderId, Number(row.targetCount)]),
    );
    expect(targets.get(uuidFor(1))).toBe(2);
    expect(targets.get(uuidFor(2))).toBe(2);
    expect(targets.get(uuidFor(3))).toBe(4);
    expect(targets.get(uuidFor(4))).toBe(1);
    expect(targets.get(uuidFor(5))).toBe(1);
    expect(targets.has(uuidFor(6))).toBe(false);
  });

  it("is idempotent and updates in place without duplicating rows", async () => {
    const result = await syncTargets({
      month: MONTH,
      actorId: ACTOR_ID,
      entries: [
        { source: "FASKES_FKTP", targetCount: 3 },
        { source: "FASKES_FKRTL", targetCount: 4 },
        { source: "PEMDA", targetCount: 1 },
        { source: "OTHER", targetCount: 1 },
      ],
      db,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(5);

    const rows = await db
      .select({
        stakeholderId: schema.kpiTargets.stakeholderId,
        targetCount: schema.kpiTargets.targetCount,
      })
      .from(schema.kpiTargets);
    expect(rows).toHaveLength(5);
    expect(
      rows.find((row) => row.stakeholderId === uuidFor(1))?.targetCount,
    ).toBe(3);

    const preview = await getTargetSyncPreview(MONTH, db);
    const fktp = preview.sources.find(
      (source) => source.source === "FASKES_FKTP",
    );
    expect(fktp).toMatchObject({
      activeOrganizations: 2,
      withTarget: 2,
      missing: 0,
      currentTarget: 3,
      uniform: true,
    });
  });

  it("leaves sub-theme and branch-scoped manual targets untouched", async () => {
    await db.insert(schema.kpiTargets).values([
      {
        workspaceLabel: "Workspace",
        stakeholderId: uuidFor(1),
        subTheme: "MOBILE_JKN",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        targetCount: 99,
        createdBy: ACTOR_ID,
      },
    ]);

    await syncTargets({
      month: MONTH,
      actorId: ACTOR_ID,
      entries: [{ source: "FASKES_FKTP", targetCount: 7 }],
      db,
    });

    const manual = await db
      .select({ targetCount: schema.kpiTargets.targetCount })
      .from(schema.kpiTargets)
      .where(
        and(
          eq(schema.kpiTargets.stakeholderId, uuidFor(1)),
          eq(schema.kpiTargets.subTheme, "MOBILE_JKN"),
        ),
      );
    expect(manual.map((row) => Number(row.targetCount))).toEqual([99]);

    const orgTarget = await db
      .select({ targetCount: schema.kpiTargets.targetCount })
      .from(schema.kpiTargets)
      .where(
        and(
          eq(schema.kpiTargets.stakeholderId, uuidFor(1)),
          isNull(schema.kpiTargets.subTheme),
        ),
      );
    expect(orgTarget.map((row) => Number(row.targetCount))).toEqual([7]);
  });

  it("records an append-only history for every synchronized target", async () => {
    const history = await db
      .select({
        targetCount: schema.kpiTargetHistory.targetCount,
        changeType: schema.kpiTargetHistory.changeType,
      })
      .from(schema.kpiTargetHistory)
      .where(eq(schema.kpiTargetHistory.stakeholderId, uuidFor(1)));

    expect(
      history.map((row) => `${row.changeType}:${row.targetCount}`),
    ).toEqual(["CREATED:2", "UPDATED:3", "UPDATED:7"]);
  });
});
