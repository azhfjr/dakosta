import { describe, expect, it } from "vitest";

import { isProtectedAccountEmail } from "../src/lib/authz/protected-accounts";
import { SUB_THEMES } from "../src/lib/taxonomy";
import {
  DEMO_ACCOUNTS,
  DEMO_BRANCHES,
  DEMO_DOMAIN,
  DEMO_ORGANIZATIONS,
  DEMO_REGIONS,
  assertFixtureIntegrity,
  buildDemoDataset,
  expectedCounts,
  jakartaDateOnly,
  organizationForContent,
  type DemoStatus,
} from "../scripts/demo-fixtures";
import { collectDemoScope } from "../scripts/demo-purge";

const OCTOBER = new Date("2026-10-31T05:00:00.000Z");
const JANUARY = new Date("2026-01-15T05:00:00.000Z");
const SAMPLES = [OCTOBER, JANUARY];

const EXACT_STATUS: Record<DemoStatus, number> = {
  DRAFT: 7,
  SUBMITTED: 8,
  RESUBMITTED: 3,
  IN_REVIEW: 4,
  APPROVED: 14,
  REVISION_REQUIRED: 5,
  REJECTED: 4,
  REVOKED: 2,
  ARCHIVED: 3,
};

describe.each(SAMPLES)("demo fixtures at %s", (now) => {
  it("passes integrity checks and matches the published matrix", () => {
    expect(() => assertFixtureIntegrity(now)).not.toThrow();

    const dataset = buildDemoDataset(now);
    const counts = expectedCounts(now);

    expect(dataset.regions).toHaveLength(3);
    expect(dataset.branches).toHaveLength(8);
    expect(dataset.organizations).toHaveLength(20);
    expect(dataset.accounts).toHaveLength(32);
    expect(counts.regions).toBe(3);
    expect(counts.branches).toBe(8);
    expect(counts.organizations).toBe(20);
    expect(counts.faskes).toBe(15);
    expect(counts.pemda).toBe(1);
    expect(counts.other).toBe(4);
    expect(counts.masterAccounts).toBe(1);
    expect(counts.regionalAccounts).toBe(3);
    expect(counts.branchAccounts).toBe(8);
    expect(counts.stakeholderAccounts).toBe(20);
    expect(counts.submissions).toBe(50);
    expect(counts.status).toEqual(EXACT_STATUS);
    expect(counts.pending).toBe(15);
    expect(counts.approved).toBe(14);
    expect(counts.nonDraft).toBe(43);
    expect(counts.mapPoints).toBe(40);
    expect(counts.edufast).toBe(18);
    expect(counts.edufastDistinctSubthemes).toBe(6);
    expect(counts.video).toBe(25);
    expect(counts.infografis).toBe(25);
    expect(counts.revisions).toBe(46);
    expect(counts.reviews).toBe(33);
    expect(counts.targets).toBe(28);
    expect(counts.notifications).toBe(53);
    expect(counts.outbox).toBe(53);
    expect(counts.audits).toBe(36);
    expect(counts.locations).toBe(50);
    expect(counts.branchPending).toEqual([1, 2, 2, 3, 3, 1, 1, 2]);
    expect(counts.branchApproved).toEqual([4, 2, 3, 2, 1, 1, 1, 0]);
    expect(counts.regionSubmissions).toEqual([27, 17, 6]);
    expect(counts.approvedCurrent).toBe(8);
    expect(counts.approvedPrevious).toBe(6);
  });

  it("keeps dates inside the two demo periods and never in the future", () => {
    const dataset = buildDemoDataset(now);
    const today = jakartaDateOnly(now);

    for (const submission of dataset.submissions) {
      expect(
        submission.period === dataset.currentPeriod ||
          submission.period === dataset.previousPeriod,
      ).toBe(true);
      expect(submission.dateCreated.startsWith(submission.period)).toBe(true);
      expect(submission.dateCreated <= today).toBe(true);
      for (const stamp of [
        submission.createdAt,
        submission.submittedAt,
        submission.approvedAt,
        submission.revokedAt,
        submission.updatedAt,
      ]) {
        if (stamp) expect(stamp.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }

    for (const review of dataset.reviews) {
      expect(review.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    }
    for (const notification of dataset.notifications) {
      expect(notification.createdAt.getTime()).toBeLessThanOrEqual(
        now.getTime(),
      );
    }
  });

  it("covers all six EDUFAST sub-themes in both periods", () => {
    const dataset = buildDemoDataset(now);
    for (const period of [dataset.currentPeriod, dataset.previousPeriod]) {
      const covered = new Set(
        dataset.submissions
          .filter(
            (submission) =>
              submission.period === period &&
              submission.mainTheme === "EDUFAST",
          )
          .map((submission) => submission.subTheme),
      );
      expect([...covered].sort()).toEqual([...SUB_THEMES].sort());
    }
    expect(dataset.policies.map((policy) => policy.period).sort()).toEqual(
      [dataset.currentPeriod, dataset.previousPeriod].sort(),
    );
    expect(dataset.policyEvents).toHaveLength(4);
  });

  it("maps content to the 20 stakeholders without gaps", () => {
    const dataset = buildDemoDataset(now);
    const perOrganization = new Map<number, number>();
    for (const submission of dataset.submissions) {
      expect(submission.organizationN).toBe(
        organizationForContent(submission.n),
      );
      perOrganization.set(
        submission.organizationN,
        (perOrganization.get(submission.organizationN) ?? 0) + 1,
      );
    }

    expect(perOrganization.size).toBe(20);
    for (const organization of DEMO_ORGANIZATIONS) {
      const total = perOrganization.get(organization.n) ?? 0;
      expect(total).toBe(organization.n <= 10 ? 3 : 2);
    }
  });
});

describe("demo scope and account identity", () => {
  it("uses only demo-domain emails and never a protected account", () => {
    const scope = collectDemoScope(OCTOBER);
    expect(scope.emails).toHaveLength(32);
    expect(new Set(scope.emails).size).toBe(32);
    for (const email of scope.emails) {
      expect(email.endsWith(`@${DEMO_DOMAIN}`)).toBe(true);
      expect(isProtectedAccountEmail(email)).toBe(false);
    }
    for (const account of DEMO_ACCOUNTS) {
      expect(account.email).toBe(account.email.toLowerCase());
    }
  });

  it("produces stable, unique identifiers for every table", () => {
    const scope = collectDemoScope(OCTOBER);
    for (const key of Object.keys(scope) as Array<keyof typeof scope>) {
      if (key === "emails") continue;
      const ids = scope[key] as string[];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/);
      }
    }

    const first = collectDemoScope(OCTOBER);
    const second = collectDemoScope(OCTOBER);
    expect(second).toEqual(first);
    const nextMonth = collectDemoScope(new Date("2026-11-20T05:00:00.000Z"));
    expect(nextMonth.userIds).toEqual(first.userIds);
    expect(nextMonth.submissionIds).toEqual(first.submissionIds);
  });

  it("has three regions with eight branches and unique codes", () => {
    expect(DEMO_REGIONS.map((region) => region.code)).toEqual([
      "REG-DEMO-JB",
      "REG-DEMO-DKI",
      "REG-DEMO-JTM",
    ]);
    expect(new Set(DEMO_BRANCHES.map((branch) => branch.code)).size).toBe(8);
    for (const branch of DEMO_BRANCHES) {
      expect(DEMO_REGIONS.some((region) => region.n === branch.regionN)).toBe(
        true,
      );
    }
    for (const organization of DEMO_ORGANIZATIONS) {
      expect(
        DEMO_BRANCHES.some((branch) => branch.n === organization.branchN),
      ).toBe(true);
    }
    expect(
      new Set(DEMO_ORGANIZATIONS.map((org) => org.faskesCode).filter(Boolean))
        .size,
    ).toBe(15);
  });
});
