import { createHash } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import { chunk } from "./demo-chunk";
import {
  DEMO_ACCOUNTS,
  DEMO_BRANCHES,
  DEMO_IDS,
  DEMO_ORGANIZATIONS,
  DEMO_REGIONS,
  DEMO_VOLUME,
  buildDemoDataset,
  type DemoVolume,
} from "./demo-fixtures";

export type DemoScope = {
  userIds: string[];
  regionIds: string[];
  branchIds: string[];
  stakeholderIds: string[];
  submissionIds: string[];
  locationIds: string[];
  reviewIds: string[];
  revisionIds: string[];
  targetIds: string[];
  notificationIds: string[];
  outboxIds: string[];
  auditIds: string[];
  policyIds: string[];
  policyEventIds: string[];
  roleMembershipIds: string[];
  membershipIds: string[];
  stakeholderMembershipIds: string[];
  emails: string[];
};

export function collectDemoScope(
  now: Date = new Date(),
  volume: DemoVolume = DEMO_VOLUME,
): DemoScope {
  const dataset = buildDemoDataset(now, volume);
  return {
    userIds: DEMO_ACCOUNTS.map((account) => DEMO_IDS.user(account.n)),
    regionIds: DEMO_REGIONS.map((region) => DEMO_IDS.region(region.n)),
    branchIds: DEMO_BRANCHES.map((branch) => DEMO_IDS.branch(branch.n)),
    stakeholderIds: DEMO_ORGANIZATIONS.map((organization) =>
      DEMO_IDS.organization(organization.n),
    ),
    submissionIds: dataset.submissions.map((submission) => submission.id),
    locationIds: dataset.locations.map((location) => location.id),
    reviewIds: dataset.reviews.map((review) => review.id),
    revisionIds: dataset.revisions.map((revision) => revision.id),
    targetIds: dataset.targets.map((target) => target.id),
    notificationIds: dataset.notifications.map(
      (notification) => notification.id,
    ),
    outboxIds: dataset.outbox.map((item) => item.id),
    auditIds: dataset.audits.map((audit) => audit.id),
    policyIds: dataset.policies.map((policy) => policy.id),
    policyEventIds: dataset.policyEvents.map((event) => event.id),
    roleMembershipIds: DEMO_ACCOUNTS.map((account) =>
      DEMO_IDS.roleMembership(account.n),
    ),
    membershipIds: DEMO_ACCOUNTS.map((account) =>
      DEMO_IDS.membership(account.n),
    ),
    stakeholderMembershipIds: DEMO_ACCOUNTS.filter(
      (account) => account.organizationN !== null,
    ).map((account) => DEMO_IDS.stakeholderMembership(account.organizationN!)),
    emails: DEMO_ACCOUNTS.map((account) => account.email),
  };
}

export type SqlExecutor = {
  execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function uuidList(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}::uuid`),
    sql`, `,
  );
}

function textList(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

async function remove(tx: SqlExecutor, query: SQL): Promise<void> {
  await tx.execute(query);
}

async function removeInChunks(
  tx: SqlExecutor,
  ids: readonly string[],
  buildQuery: (values: string[]) => SQL,
): Promise<void> {
  for (const part of chunk([...ids])) {
    await remove(tx, buildQuery(part));
  }
}

/**
 * Deletes only the explicit demo ids produced by `demo-fixtures`. Themes,
 * rate limits, migration runs, and every non-demo row are left untouched.
 */
export async function purgeDemoOnly(
  tx: SqlExecutor,
  scope: DemoScope,
): Promise<void> {
  if (scope.userIds.length === 0) return;

  await removeInChunks(
    tx,
    scope.outboxIds,
    (ids) => sql`delete from outbox_events where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.notificationIds,
    (ids) => sql`delete from notifications where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.reviewIds,
    (ids) => sql`delete from content_reviews where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.revisionIds,
    (ids) => sql`delete from content_revisions where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.submissionIds,
    (ids) =>
      sql`delete from content_submissions where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.targetIds,
    (ids) => sql`delete from kpi_targets where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.locationIds,
    (ids) => sql`delete from locations where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.policyEventIds,
    (ids) =>
      sql`delete from edufast_policy_events where id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.policyIds,
    (ids) =>
      sql`delete from edufast_policy_subthemes where policy_id in (${uuidList(ids)})`,
  );
  await removeInChunks(
    tx,
    scope.policyIds,
    (ids) =>
      sql`delete from edufast_monthly_policies where id in (${uuidList(ids)})`,
  );
  await remove(
    tx,
    sql`delete from organization_transfers where organization_id in (${uuidList(scope.stakeholderIds)})`,
  );
  await remove(
    tx,
    sql`delete from account_invitations where user_id in (${textList(scope.userIds)}) or created_by in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from account_import_rows where user_id in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from account_imports where actor_id in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from user_stakeholder_memberships where id in (${uuidList(scope.stakeholderMembershipIds)})`,
  );
  await remove(
    tx,
    sql`delete from user_memberships where id in (${uuidList(scope.membershipIds)})`,
  );
  await remove(
    tx,
    sql`delete from user_role_memberships where id in (${uuidList(scope.roleMembershipIds)})`,
  );
  await remove(
    tx,
    sql`delete from stakeholders where id in (${uuidList(scope.stakeholderIds)})`,
  );
  await remove(
    tx,
    sql`delete from branch_offices where id in (${uuidList(scope.branchIds)})`,
  );
  await remove(
    tx,
    sql`delete from regional_offices where id in (${uuidList(scope.regionIds)})`,
  );
  await removeInChunks(
    tx,
    scope.auditIds,
    (ids) => sql`delete from audit_logs where id in (${uuidList(ids)})`,
  );
  await remove(
    tx,
    sql`delete from session where user_id in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from account where user_id in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from verification where identifier in (${textList(scope.emails)})`,
  );
  await remove(
    tx,
    sql`delete from user_profiles where user_id in (${textList(scope.userIds)})`,
  );
  await remove(
    tx,
    sql`delete from "user" where id in (${textList(scope.userIds)})`,
  );
}

export type DemoInvariants = {
  nonDemoProfiles: number;
  nonDemoStakeholders: number;
  nonDemoSubmissions: number;
  nonDemoRegions: number;
  nonDemoBranches: number;
  masterUserId: string | null;
  masterPasswordFingerprint: string | null;
  masterAdminMemberships: number;
  foreignDemoUsers: number;
  halfDemoUsers: number;
};

function readNumber(row: Record<string, unknown> | undefined): number {
  return Number(row?.value ?? 0);
}

async function readScalar(reader: SqlExecutor, query: SQL): Promise<number> {
  const result = await reader.execute(query);
  return readNumber(result.rows[0]);
}

function fingerprintSecret(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Reads the non-demo invariants that must survive a seed. Works on a pooled
 * client before the transaction and on the transaction itself right before
 * commit, so a mismatch still rolls back.
 */
export async function snapshotInvariants(
  reader: SqlExecutor,
): Promise<DemoInvariants> {
  const demoUsers = collectDemoScope().userIds;
  const demoUserList = textList(demoUsers);

  const master = await reader.execute(sql`
    select u.id, a.password
      from "user" u
      left join account a
        on a.user_id = u.id and a.provider_id = 'credential'
     where u.email = 'admin@dakosta.local'
     limit 1
  `);
  const masterRow = master.rows[0] as
    { id: string; password: string | null } | undefined;

  const masterAdminMemberships = await readScalar(
    reader,
    sql`
      select count(*)::text as value
        from user_memberships
       where role = 'MASTER_ADMIN'
         and revoked_at is null
         and ${masterRow ? sql`user_id = ${masterRow.id}` : sql`true`}
    `,
  );

  const foreignDemoUsers = await readScalar(
    reader,
    sql`
      select count(*)::text as value
        from "user"
       where email like '%@demo.dakosta.local'
         and not (id in (${demoUserList}))
    `,
  );

  const halfDemoUsers = await readScalar(
    reader,
    sql`
      select count(*)::text as value
        from "user" u
        left join user_profiles p on p.user_id = u.id
       where u.email like '%@demo.dakosta.local'
         and (p.user_id is null or p.is_demo = false)
    `,
  );

  const counts = await reader.execute(sql`
    select
      (select count(*) from user_profiles where is_demo = false)::text as non_demo_profiles,
      (select count(*) from stakeholders where is_demo = false)::text as non_demo_stakeholders,
      (select count(*) from content_submissions where is_demo = false)::text as non_demo_submissions,
      (select count(*) from regional_offices where code not like 'REG-DEMO-%')::text as non_demo_regions,
      (select count(*) from branch_offices where code not like 'CBG-DEMO-%')::text as non_demo_branches
  `);
  const counter = counts.rows[0];

  return {
    nonDemoProfiles: Number(counter?.non_demo_profiles ?? "0"),
    nonDemoStakeholders: Number(counter?.non_demo_stakeholders ?? "0"),
    nonDemoSubmissions: Number(counter?.non_demo_submissions ?? "0"),
    nonDemoRegions: Number(counter?.non_demo_regions ?? "0"),
    nonDemoBranches: Number(counter?.non_demo_branches ?? "0"),
    masterUserId: masterRow?.id ?? null,
    masterPasswordFingerprint: fingerprintSecret(masterRow?.password ?? null),
    masterAdminMemberships,
    foreignDemoUsers,
    halfDemoUsers,
  };
}

export function assertInvariantsPreserved(
  before: DemoInvariants,
  after: DemoInvariants,
): void {
  const keys = Object.keys(before) as Array<keyof DemoInvariants>;
  const changed = keys.filter((key) => before[key] !== after[key]);
  if (changed.length > 0) {
    throw new Error(
      `Invariant non-demo berubah (${changed.join(", ")}). Transaksi dibatalkan.`,
    );
  }
}
