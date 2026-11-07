import "server-only";

import { and, eq, gte, isNotNull, lte, type SQL } from "drizzle-orm";

import { schema } from "@/db";
import type { MonthRange } from "@/lib/kpi/formulas";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Canonical "approved" definition shared by Dashboard, KPI, rankings, map,
 * exports, and PDF. Approval means a final decision with a timestamp; archived
 * and soft-deleted rows never count.
 */
export function approvedContentCondition(): SQL {
  return and(
    eq(schema.contentSubmissions.status, "APPROVED"),
    isNotNull(schema.contentSubmissions.approvedAt),
    eq(schema.contentSubmissions.archived, false),
  )!;
}

export function approvedAtBetween(range: MonthRange): SQL {
  return and(
    gte(schema.contentSubmissions.approvedAt, range.startInstant),
    lte(schema.contentSubmissions.approvedAt, range.endInstant),
  )!;
}

export function approvedAtBetweenInstants(start: Date, end: Date): SQL {
  return and(
    gte(schema.contentSubmissions.approvedAt, start),
    lte(schema.contentSubmissions.approvedAt, end),
  )!;
}

function parseDateKey(dateKey: string): [number, number, number] {
  const [year, month, day] = dateKey.split("-").map(Number);
  return [year!, month!, day!];
}

/** 00:00:00 Asia/Jakarta on the given calendar date, as an instant. */
export function jakartaDayStart(dateKey: string): Date {
  const [year, month, day] = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}

/** 00:00:00 Asia/Jakarta on the day after the given date, as an instant. */
export function jakartaDayEndExclusive(dateKey: string): Date {
  const [year, month, day] = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day + 1) - WIB_OFFSET_MS);
}
