import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import {
  DEMO_IDS,
  buildDemoDataset,
  expectedCounts,
} from "../scripts/demo-fixtures";
import {
  assertInvariantsPreserved,
  collectDemoScope,
  purgeDemoOnly,
  snapshotInvariants,
  type SqlExecutor,
} from "../scripts/demo-purge";
import {
  assertSeededCounts,
  insertDemoDataset,
  type SeedTx,
} from "../scripts/seed-demo-production";

const MASTER_PASSWORD = "MasterAsliSangatKuat123";
const DEMO_PASSWORD = "DemoBersamaSangatKuat123";
const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
  "0004_v1_1_foundations.sql",
];

const NOW = new Date("2026-10-31T05:00:00.000Z");

async function createDatabase() {
  const client = new PGlite();
  for (const file of MIGRATIONS) {
    const content = readFileSync(join(process.cwd(), "drizzle", file), "utf8");
    await client.exec(content);
  }
  return client;
}

async function countRows(
  client: PGlite,
  table: string,
  where = "",
): Promise<number> {
  const result = await client.query<{ total: string }>(
    `select count(*)::text as total from "${table}" ${where}`,
  );
  return Number(result.rows[0]?.total ?? "0");
}

describe("production demo seed against Postgres semantics", () => {
  it("inserts the full dataset, preserves real data, and is idempotent", async () => {
    const client = await createDatabase();
    const db = drizzle(client, { schema });
    const reader = db as unknown as SqlExecutor;

    try {
      const masterHash = await hashPassword(MASTER_PASSWORD);
      const demoHash = await hashPassword(DEMO_PASSWORD);

      await client.query(
        `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
           values ('real-master-0001', 'Master Asli', 'admin@dakosta.local', true, 'admin', now(), now())`,
      );
      await client.query(
        `insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
           values ('real-account-0001', 'real-master-0001', 'credential', 'real-master-0001', $1, now(), now())`,
        [masterHash],
      );
      await client.query(
        `insert into user_profiles (user_id, must_change_password, is_demo, active, status, created_at, updated_at)
           values ('real-master-0001', false, false, true, 'ACTIVE', now(), now())`,
      );
      await client.query(
        `insert into user_role_memberships (user_id, role) values ('real-master-0001', 'ADMIN')`,
      );
      await client.query(
        `insert into user_memberships (user_id, role, effective_at) values ('real-master-0001', 'MASTER_ADMIN', now())`,
      );

      await client.query(
        `insert into regional_offices (id, code, name, status) values
           ('aaaaaaaa-0000-4000-8000-000000000001', 'REG-REAL-1', 'Wilayah Nyata', 'ACTIVE')`,
      );
      await client.query(
        `insert into branch_offices (id, regional_office_id, code, name, status) values
           ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'CBG-REAL-1', 'Cabang Nyata', 'ACTIVE')`,
      );
      await client.query(
        `insert into stakeholders (id, name, category, branch_office_id, organization_type, service_area, latitude, longitude, status, is_demo, joined_at)
           values ('aaaaaaaa-0000-4000-8000-000000000003', 'Mitra Nyata', 'ORGANISASI', 'aaaaaaaa-0000-4000-8000-000000000002', 'OTHER', 'Kota Nyata', -6.9, 107.6, 'ACTIVE', false, '2025-01-01')`,
      );
      await client.query(
        `insert into themes (id, slug, name, active, sort_order, version)
           values ('aaaaaaaa-0000-4000-8000-000000000004', 'edukasi-jkn', 'Edukasi JKN (referensi)', true, 99, 1)`,
      );
      await client.query(
        `insert into locations (id, latitude, longitude, label, source, verified_status, precision)
           values ('aaaaaaaa-0000-4000-8000-000000000005', -6.9, 107.6, 'Titik Nyata', 'manual_pin', 'MANUAL_UNVERIFIED', 'approximate')`,
      );
      await client.query(
        `insert into content_submissions (
             id, reference_code, stakeholder_id, created_by, submitted_by, narrative,
             published_url, normalized_url, normalized_url_hash, platform, date_created,
             location_id, status, idempotency_key, is_demo, created_at, updated_at
           ) values (
             'aaaaaaaa-0000-4000-8000-000000000006', 'DKS-202509-R0001',
             'aaaaaaaa-0000-4000-8000-000000000003', 'real-master-0001', 'real-master-0001',
             'Konten asli non-demo untuk menguji invarian.',
             'https://contoh.example/konten/asli', 'https://contoh.example/konten/asli', 'hash-asli',
             'WEBSITE', '2025-09-10',
             'aaaaaaaa-0000-4000-8000-000000000005', 'APPROVED', 'real-seed:submission:0001', false, now(), now()
           )`,
      );

      const before = await snapshotInvariants(reader);
      expect(before.nonDemoProfiles).toBe(1);
      expect(before.nonDemoSubmissions).toBe(1);
      expect(before.nonDemoRegions).toBe(1);
      expect(before.nonDemoBranches).toBe(1);
      expect(before.masterUserId).toBe("real-master-0001");
      expect(before.masterAdminMemberships).toBe(1);

      const dataset = buildDemoDataset(NOW);
      const counts = expectedCounts(NOW);
      const scope = collectDemoScope(NOW);

      const seedOnce = async () => {
        await db.transaction(async (tx) => {
          await purgeDemoOnly(tx as unknown as SqlExecutor, scope);
          await insertDemoDataset(tx as unknown as SeedTx, dataset, demoHash);
          await assertSeededCounts(
            tx as unknown as SeedTx,
            dataset,
            scope,
            before,
            counts,
          );
        });
      };

      await seedOnce();

      const afterFirst = await snapshotInvariants(reader);
      assertInvariantsPreserved(before, afterFirst);

      expect(
        await countRows(client, "user_profiles", "where is_demo = true"),
      ).toBe(32);
      expect(
        await countRows(
          client,
          "user",
          "where email like '%@demo.dakosta.local'",
        ),
      ).toBe(32);
      expect(
        await countRows(client, "content_submissions", "where is_demo = true"),
      ).toBe(50);
      expect(
        await countRows(client, "content_submissions", "where is_demo = false"),
      ).toBe(1);
      expect(await countRows(client, "locations")).toBe(51);
      expect(await countRows(client, "themes")).toBe(5);
      expect(
        await countRows(client, "themes", "where slug = 'edukasi-jkn'"),
      ).toBe(1);
      expect(await countRows(client, "edufast_monthly_policies")).toBe(2);
      expect(await countRows(client, "edufast_policy_subthemes")).toBe(12);
      expect(await countRows(client, "content_revisions")).toBe(46);
      expect(await countRows(client, "content_reviews")).toBe(33);
      expect(await countRows(client, "kpi_targets")).toBe(28);
      expect(await countRows(client, "notifications")).toBe(53);
      expect(await countRows(client, "outbox_events")).toBe(53);
      expect(await countRows(client, "audit_logs")).toBe(36);

      const masterAfter = await client.query<{ password: string }>(
        `select a.password from "user" u join account a
             on a.user_id = u.id and a.provider_id = 'credential'
            where u.email = 'admin@dakosta.local'`,
      );
      expect(masterAfter.rows[0]?.password).toBe(masterHash);
      await expect(
        verifyPassword({
          password: MASTER_PASSWORD,
          hash: masterAfter.rows[0]!.password,
        }),
      ).resolves.toBe(true);

      const demoAccount = await client.query<{
        password: string;
        role: string;
      }>(
        `select a.password, u.role from "user" u join account a
             on a.user_id = u.id and a.provider_id = 'credential'
            where u.email = 'admin@demo.dakosta.local'`,
      );
      expect(demoAccount.rows[0]?.role).toBe("user");
      await expect(
        verifyPassword({
          password: DEMO_PASSWORD,
          hash: demoAccount.rows[0]!.password,
        }),
      ).resolves.toBe(true);

      const allDemoAccounts = await client.query<{
        password: string;
        role: string;
      }>(
        `select a.password, u.role from "user" u join account a
             on a.user_id = u.id and a.provider_id = 'credential'
            where u.email like '%@demo.dakosta.local'`,
      );
      expect(allDemoAccounts.rows).toHaveLength(32);
      for (const row of allDemoAccounts.rows) {
        expect(row.role).toBe("user");
        await expect(
          verifyPassword({ password: DEMO_PASSWORD, hash: row.password }),
        ).resolves.toBe(true);
      }

      const sampleSubmission = await client.query<{ id: string }>(
        `select id from content_submissions where reference_code = 'DKS-202610-D0021'`,
      );
      const sampleId = sampleSubmission.rows[0]?.id;
      expect(sampleId).toBe(DEMO_IDS.submission(21));

      await seedOnce();

      expect(
        await countRows(client, "user_profiles", "where is_demo = true"),
      ).toBe(32);
      expect(
        await countRows(client, "content_submissions", "where is_demo = true"),
      ).toBe(50);
      expect(await countRows(client, "content_revisions")).toBe(46);
      expect(await countRows(client, "content_reviews")).toBe(33);
      expect(await countRows(client, "notifications")).toBe(53);
      expect(await countRows(client, "outbox_events")).toBe(53);
      expect(await countRows(client, "themes")).toBe(5);
      const sampleAfterRerun = await client.query<{ id: string }>(
        `select id from content_submissions where reference_code = 'DKS-202610-D0021'`,
      );
      expect(sampleAfterRerun.rows[0]?.id).toBe(sampleId);

      const afterSecond = await snapshotInvariants(reader);
      assertInvariantsPreserved(before, afterSecond);

      await db.transaction(async (tx) => {
        await purgeDemoOnly(tx as unknown as SqlExecutor, scope);
        const purged = await snapshotInvariants(tx as unknown as SqlExecutor);
        assertInvariantsPreserved(before, purged);
      });

      expect(
        await countRows(client, "user_profiles", "where is_demo = true"),
      ).toBe(0);
      expect(
        await countRows(
          client,
          "user",
          "where email like '%@demo.dakosta.local'",
        ),
      ).toBe(0);
      expect(
        await countRows(client, "content_submissions", "where is_demo = true"),
      ).toBe(0);
      expect(
        await countRows(client, "content_submissions", "where is_demo = false"),
      ).toBe(1);
      expect(await countRows(client, "themes")).toBe(5);
      expect(
        await countRows(client, "user_profiles", "where is_demo = false"),
      ).toBe(1);

      const masterFinal = await client.query<{ password: string }>(
        `select password from account where user_id = 'real-master-0001'`,
      );
      expect(masterFinal.rows[0]?.password).toBe(masterHash);
    } finally {
      await client.close();
    }
  }, 180_000);
});
