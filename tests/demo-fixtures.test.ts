import { describe, expect, it } from "vitest";

import { isProtectedAccountEmail } from "../src/lib/authz/protected-accounts";
import { SUB_THEMES } from "../src/lib/taxonomy";
import {
  DEMO_ACCOUNTS,
  DEMO_BRANCHES,
  DEMO_DOMAIN,
  DEMO_ORGANIZATIONS,
  DEMO_REGIONS,
  DEMO_VOLUME,
  DEMO_VOLUME_TEST,
  assertFixtureIntegrity,
  buildDemoDataset,
  demoSubmissionTotal,
  demoTargetTotal,
  expectedCounts,
  jakartaDateOnly,
  organizationForContent,
  type DemoStatus,
} from "../scripts/demo-fixtures";
import { collectDemoScope } from "../scripts/demo-purge";

const OCTOBER = new Date("2026-10-31T05:00:00.000Z");
const JANUARY = new Date("2026-01-15T05:00:00.000Z");
const SAMPLES = [OCTOBER, JANUARY];

const DECISION_STATUSES: readonly DemoStatus[] = [
  "APPROVED",
  "REVISION_REQUIRED",
];

describe("demo volume constants", () => {
  it("keeps the production volume at 2,400 submissions and 648 targets", () => {
    expect(DEMO_VOLUME).toEqual({ months: 24, slotsPerOrgMonth: 5 });
    expect(demoSubmissionTotal(DEMO_VOLUME)).toBe(2400);
    expect(demoTargetTotal(DEMO_VOLUME)).toBe(648);
    expect(demoSubmissionTotal(DEMO_VOLUME_TEST)).toBe(300);
    expect(demoTargetTotal(DEMO_VOLUME_TEST)).toBe(81);
  });
});

describe.each(SAMPLES)("demo fixtures (compact volume) at %s", (now) => {
  it("passes integrity checks and derives every relational count", () => {
    expect(() => assertFixtureIntegrity(now, DEMO_VOLUME_TEST)).not.toThrow();

    const dataset = buildDemoDataset(now, DEMO_VOLUME_TEST);
    const counts = expectedCounts(now, DEMO_VOLUME_TEST);
    const perPeriod =
      DEMO_ORGANIZATIONS.length * DEMO_VOLUME_TEST.slotsPerOrgMonth;
    const perOrganization =
      DEMO_VOLUME_TEST.months * DEMO_VOLUME_TEST.slotsPerOrgMonth;
    const nonDraft = dataset.submissions.filter(
      (submission) => submission.status !== "DRAFT",
    ).length;
    const resubmitted = dataset.submissions.filter(
      (submission) =>
        submission.status === "SUBMITTED" && submission.version > 1,
    ).length;
    const decisionReviews = dataset.submissions.filter((submission) =>
      DECISION_STATUSES.includes(submission.status),
    ).length;

    expect(counts.regions).toBe(3);
    expect(counts.branches).toBe(8);
    expect(counts.organizations).toBe(20);
    expect(counts.accounts).toBe(32);
    expect(counts.faskes).toBe(15);
    expect(counts.pemda).toBe(1);
    expect(counts.other).toBe(4);
    expect(counts.masterAccounts).toBe(1);
    expect(counts.regionalAccounts).toBe(3);
    expect(counts.branchAccounts).toBe(8);
    expect(counts.stakeholderAccounts).toBe(20);
    expect(counts.periods).toHaveLength(DEMO_VOLUME_TEST.months);
    expect(counts.submissions).toBe(demoSubmissionTotal(DEMO_VOLUME_TEST));
    expect(counts.policies).toBe(DEMO_VOLUME_TEST.months);
    expect(counts.policySubthemes).toBe(
      DEMO_VOLUME_TEST.months * SUB_THEMES.length,
    );
    expect(counts.policyEvents).toBe(DEMO_VOLUME_TEST.months * 2);
    expect(counts.targets).toBe(demoTargetTotal(DEMO_VOLUME_TEST));
    expect(counts.locations).toBe(counts.submissions);
    expect(counts.revisions).toBe(nonDraft + resubmitted);
    expect(counts.reviews).toBe(decisionReviews + resubmitted);
    expect(counts.pending).toBe(counts.status.SUBMITTED);
    expect(counts.notifications).toBe(counts.pending + counts.reviews + 5);
    expect(counts.outbox).toBe(counts.notifications);
    expect(counts.audits).toBe(counts.reviews + 3);
    expect(counts.nonDraft).toBe(nonDraft);
    expect(counts.mapPoints).toBe(
      dataset.submissions.filter(
        (submission) => submission.status !== "DRAFT" && !submission.archived,
      ).length,
    );
    expect(counts.edufastDistinctSubthemes).toBe(SUB_THEMES.length);
    expect(counts.video + counts.infografis).toBe(counts.submissions);
    expect(counts.branchPending).toHaveLength(DEMO_BRANCHES.length);
    expect(counts.branchApproved).toHaveLength(DEMO_BRANCHES.length);
    expect(counts.regionSubmissions).toHaveLength(DEMO_REGIONS.length);
    expect(counts.branchPending.every((value) => value > 0)).toBe(true);
    expect(counts.branchApproved.every((value) => value > 0)).toBe(true);
    expect(counts.regionSubmissions.every((value) => value > 0)).toBe(true);
    expect(counts.approvedCurrent).toBe(DEMO_ORGANIZATIONS.length * 2);
    expect(counts.approvedPrevious).toBe(DEMO_ORGANIZATIONS.length * 3);
    expect(counts.approvedOldest).toBe(DEMO_ORGANIZATIONS.length * 3);
    expect(counts.currentTarget).toBe(counts.approvedCurrent + 20);
    for (const value of Object.values(counts.status)) {
      expect(value).toBeGreaterThan(0);
    }
    expect(counts.status.APPROVED).toBeGreaterThanOrEqual(
      DEMO_ORGANIZATIONS.length * DEMO_VOLUME_TEST.months * 2,
    );
    expect(counts.submissions).toBe(perPeriod * DEMO_VOLUME_TEST.months);
    expect(
      dataset.submissions.filter(
        (submission) => submission.organizationN === 1,
      ),
    ).toHaveLength(perOrganization);
  });

  it("keeps dates inside the configured periods and never in the future", () => {
    const dataset = buildDemoDataset(now, DEMO_VOLUME_TEST);
    const today = jakartaDateOnly(now);

    for (const submission of dataset.submissions) {
      expect(dataset.periods).toContain(submission.period);
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

  it("covers all six EDUFAST sub-themes in every period", () => {
    const dataset = buildDemoDataset(now, DEMO_VOLUME_TEST);
    for (const period of dataset.periods) {
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
    expect(dataset.policies.map((policy) => policy.period)).toEqual(
      dataset.periods,
    );
    expect(dataset.policyEvents).toHaveLength(DEMO_VOLUME_TEST.months * 2);
  });

  it("maps content to the 20 stakeholders without gaps", () => {
    const dataset = buildDemoDataset(now, DEMO_VOLUME_TEST);
    const perOrganization = new Map<number, number>();
    for (const submission of dataset.submissions) {
      expect(submission.organizationN).toBe(
        organizationForContent(submission.n, DEMO_VOLUME_TEST),
      );
      perOrganization.set(
        submission.organizationN,
        (perOrganization.get(submission.organizationN) ?? 0) + 1,
      );
    }

    expect(perOrganization.size).toBe(20);
    for (const organization of DEMO_ORGANIZATIONS) {
      expect(perOrganization.get(organization.n) ?? 0).toBe(
        DEMO_VOLUME_TEST.months * DEMO_VOLUME_TEST.slotsPerOrgMonth,
      );
    }
  });

  it("creates 27 targets with a global row for every period", () => {
    const dataset = buildDemoDataset(now, DEMO_VOLUME_TEST);
    for (const period of dataset.periods) {
      const rows = dataset.targets.filter((target) => target.period === period);
      expect(rows).toHaveLength(1 + SUB_THEMES.length + 20);
      const global = rows.filter(
        (target) => target.organizationN === null && target.subTheme === null,
      );
      expect(global).toHaveLength(1);
      expect(
        rows
          .filter((target) => target.organizationN !== null)
          .reduce((sum, target) => sum + target.targetCount, 0),
      ).toBe(global[0]!.targetCount);
      expect(
        rows.filter(
          (target) => target.subTheme !== null && target.organizationN === null,
        ),
      ).toHaveLength(SUB_THEMES.length);
    }
  });
});

describe("demo fixtures at production volume", () => {
  it("builds 2,400 deterministic submissions over 24 months", () => {
    expect(() => assertFixtureIntegrity(OCTOBER)).not.toThrow();
    const dataset = buildDemoDataset(OCTOBER);
    const counts = expectedCounts(OCTOBER);

    expect(counts.submissions).toBe(2400);
    expect(counts.targets).toBe(648);
    expect(counts.policies).toBe(24);
    expect(counts.periods).toHaveLength(24);
    expect(counts.approved).toBe(2015);
    expect(counts.approvedCurrent).toBe(40);
    expect(counts.approvedPrevious).toBe(60);
    expect(counts.approvedOldest).toBe(96);
    expect(counts.currentTarget).toBe(60);
    expect(counts.locations).toBe(2400);
    expect(counts.revisions).toBe(2420);
    expect(counts.mapPoints).toBeGreaterThan(1000);
    expect(counts.branchPending.every((value) => value > 0)).toBe(true);
    expect(counts.branchApproved.every((value) => value > 0)).toBe(true);
    expect(
      new Set(dataset.submissions.map((item) => item.referenceCode)).size,
    ).toBe(2400);
    expect(
      new Set(dataset.submissions.map((item) => item.idempotencyKey)).size,
    ).toBe(2400);
  });

  it("builds the same dataset twice for the same instant", () => {
    const first = buildDemoDataset(OCTOBER);
    const second = buildDemoDataset(OCTOBER);
    expect(second.submissions).toEqual(first.submissions);
    expect(second.targets).toEqual(first.targets);
    expect(second.reviews).toEqual(first.reviews);
    expect(second.notifications).toEqual(first.notifications);
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
    const scope = collectDemoScope(OCTOBER, DEMO_VOLUME_TEST);
    for (const key of Object.keys(scope) as Array<keyof typeof scope>) {
      if (key === "emails") continue;
      const ids = scope[key] as string[];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/);
      }
    }

    const first = collectDemoScope(OCTOBER, DEMO_VOLUME_TEST);
    const second = collectDemoScope(OCTOBER, DEMO_VOLUME_TEST);
    expect(second).toEqual(first);
    const nextMonth = collectDemoScope(
      new Date("2026-11-20T05:00:00.000Z"),
      DEMO_VOLUME_TEST,
    );
    expect(nextMonth.userIds).toEqual(first.userIds);
    expect(nextMonth.submissionIds).toEqual(first.submissionIds);
    expect(collectDemoScope(OCTOBER).submissionIds).toHaveLength(2400);
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
