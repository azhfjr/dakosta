import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { cachedRead } from "@/lib/read-cache";

const DAY_MS = 86_400_000;

export type SlaPolicySummary = {
  id: string;
  targetDays: number | null;
  calendar: "24x7" | "BUSINESS_DAYS";
  startsAt: "FIRST_SUBMISSION" | "LATEST_SUBMISSION";
  pausesOnRevision: boolean;
  note: string | null;
  updatedAt: Date;
};

export type SlaClock = {
  clockStart: Date | null;
  deadline: Date | null;
  overdueDays: number | null;
};

/**
 * F1 default: without an active policy there is no invented due date. Aging is
 * still reported, but `deadline` and `overdueDays` stay null.
 */
export function calculateSlaClock(input: {
  firstSubmittedAt: Date | null;
  submittedAt: Date | null;
  policy: SlaPolicySummary | null;
  now?: Date;
}): SlaClock {
  const now = input.now ?? new Date();
  const clockStart =
    input.policy?.startsAt === "LATEST_SUBMISSION"
      ? (input.submittedAt ?? input.firstSubmittedAt)
      : (input.firstSubmittedAt ?? input.submittedAt);
  if (!input.policy?.targetDays || !clockStart) {
    return { clockStart, deadline: null, overdueDays: null };
  }
  const deadline = new Date(
    clockStart.getTime() + input.policy.targetDays * DAY_MS,
  );
  const overdueDays =
    now.getTime() > deadline.getTime()
      ? Math.floor((now.getTime() - deadline.getTime()) / DAY_MS)
      : 0;
  return { clockStart, deadline, overdueDays };
}

export async function getActiveSlaPolicy(): Promise<SlaPolicySummary | null> {
  return cachedRead("sla-policy:active", () => loadActiveSlaPolicy(), {
    ttlMs: 60_000,
  });
}

async function loadActiveSlaPolicy(): Promise<SlaPolicySummary | null> {
  const [row] = await getDb()
    .select({
      id: schema.slaPolicies.id,
      targetDays: schema.slaPolicies.targetDays,
      calendar: schema.slaPolicies.calendar,
      startsAt: schema.slaPolicies.startsAt,
      pausesOnRevision: schema.slaPolicies.pausesOnRevision,
      note: schema.slaPolicies.note,
      updatedAt: schema.slaPolicies.updatedAt,
    })
    .from(schema.slaPolicies)
    .where(and(eq(schema.slaPolicies.active, true)))
    .orderBy(desc(schema.slaPolicies.updatedAt))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    targetDays: row.targetDays,
    calendar: row.calendar === "BUSINESS_DAYS" ? "BUSINESS_DAYS" : "24x7",
    startsAt:
      row.startsAt === "LATEST_SUBMISSION"
        ? "LATEST_SUBMISSION"
        : "FIRST_SUBMISSION",
    pausesOnRevision: row.pausesOnRevision,
    note: row.note,
    updatedAt: row.updatedAt,
  };
}

export function slaPolicyLabel(policy: SlaPolicySummary | null): string {
  if (!policy || !policy.targetDays) {
    return "Belum ditetapkan Master Admin";
  }
  return `${policy.targetDays} hari · ${policy.calendar === "24x7" ? "kalender 24×7" : "hari kerja"}`;
}
