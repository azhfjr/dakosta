import "server-only";

import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  contentScopePredicate,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import { isValidCoordinate } from "@/lib/geo";
import type { Period } from "@/lib/periods";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import { assertCapability } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";
import { isSubTheme, type SubTheme } from "@/lib/taxonomy";

export type DashboardMapLevel = "BRANCH" | "INSTITUTION";

export type DashboardMapPoint = {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  approved: number;
  href: string;
};

export type DashboardMap = {
  level: DashboardMapLevel;
  period: Period;
  points: DashboardMapPoint[];
  totals: {
    approved: number;
    institutions: number;
    locations: number;
    zeroInstitutions: number;
    withoutCoordinates: number;
  };
  truncated: boolean;
  generatedAt: Date;
};

export const DASHBOARD_MAP_LIMIT = 5000;

export type DashboardMapFilters = {
  period: Period;
  stakeholderId?: string | null;
  subTheme?: string | null;
};

function levelFor(user: SessionUser): DashboardMapLevel {
  return user.role === "REGIONAL_ADMIN" || user.role === "MASTER_ADMIN"
    ? "BRANCH"
    : "INSTITUTION";
}

function hrefFor(
  user: SessionUser,
  period: Period,
  point: { id: string; name: string },
): string {
  const base =
    user.role === "BRANCH_ADMIN"
      ? "/cabang/kinerja"
      : user.role === "MASTER_ADMIN"
        ? "/admin"
        : "/wilayah/kinerja";
  const params = new URLSearchParams({ period: period.key });
  if (user.role === "BRANCH_ADMIN") {
    params.set("q", point.name);
  } else if (user.role === "REGIONAL_ADMIN") {
    params.set("branch", point.id);
  }
  const hash = user.role === "MASTER_ADMIN" ? "#semua-konten" : "";
  return `${base}?${params.toString()}${hash}`;
}

export async function getDashboardMap(
  user: SessionUser,
  filters: DashboardMapFilters,
): Promise<DashboardMap> {
  assertCapability(user, "map:read");
  return cachedRead(
    readCacheKey(user, [
      "dashboard-map",
      filters.period.key,
      filters.stakeholderId,
      filters.subTheme,
    ]),
    () => loadDashboardMap(user, filters),
  );
}

async function loadDashboardMap(
  user: SessionUser,
  filters: DashboardMapFilters,
): Promise<DashboardMap> {
  const db = getDb();
  const level = levelFor(user);
  const subTheme: SubTheme | null = isSubTheme(filters.subTheme ?? "")
    ? (filters.subTheme as SubTheme)
    : null;

  const approvedConditions: SQL[] = [
    eq(schema.contentSubmissions.status, "APPROVED"),
    gte(schema.contentSubmissions.approvedAt, filters.period.start),
    lt(schema.contentSubmissions.approvedAt, filters.period.endExclusive),
  ];
  const contentScope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (contentScope) approvedConditions.push(contentScope);
  if (subTheme) {
    approvedConditions.push(eq(schema.contentSubmissions.subTheme, subTheme));
  }

  const approvedAgg = db
    .select({
      stakeholderId: schema.contentSubmissions.stakeholderId,
      approved: count(sql`distinct ${schema.contentSubmissions.id}`)
        .mapWith(Number)
        .as("approved"),
    })
    .from(schema.contentSubmissions)
    .where(and(...approvedConditions))
    .groupBy(schema.contentSubmissions.stakeholderId)
    .as("map_approved");

  const institutionConditions: SQL[] = [
    eq(schema.stakeholders.status, "ACTIVE"),
  ];
  const organizationScope = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });
  if (organizationScope) institutionConditions.push(organizationScope);
  if (filters.stakeholderId) {
    institutionConditions.push(
      eq(schema.stakeholders.id, filters.stakeholderId),
    );
  }
  const institutionWhere = and(...institutionConditions);

  if (level === "BRANCH") {
    const rows = await db
      .select({
        id: schema.branchOffices.id,
        name: schema.branchOffices.name,
        regionName: schema.regionalOffices.name,
        latitude: sql<number>`avg(${schema.stakeholders.latitude})`.mapWith(
          Number,
        ),
        longitude: sql<number>`avg(${schema.stakeholders.longitude})`.mapWith(
          Number,
        ),
        approved:
          sql<number>`coalesce(sum(coalesce(${approvedAgg.approved}, 0)), 0)`.mapWith(
            Number,
          ),
        institutions: count().mapWith(Number),
      })
      .from(schema.branchOffices)
      .innerJoin(
        schema.regionalOffices,
        eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
      )
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.branchOfficeId, schema.branchOffices.id),
      )
      .leftJoin(
        approvedAgg,
        eq(approvedAgg.stakeholderId, schema.stakeholders.id),
      )
      .where(and(eq(schema.branchOffices.status, "ACTIVE"), institutionWhere))
      .groupBy(
        schema.branchOffices.id,
        schema.branchOffices.name,
        schema.regionalOffices.name,
      )
      .orderBy(
        desc(sql`coalesce(sum(coalesce(${approvedAgg.approved}, 0)), 0)`),
      )
      .limit(DASHBOARD_MAP_LIMIT + 1);

    const truncated = rows.length > DASHBOARD_MAP_LIMIT;
    let approved = 0;
    let institutions = 0;
    let zeroInstitutions = 0;
    let withoutCoordinates = 0;
    const points: DashboardMapPoint[] = [];
    for (const row of rows.slice(0, DASHBOARD_MAP_LIMIT)) {
      approved += row.approved;
      institutions += row.institutions;
      if (row.approved === 0) {
        zeroInstitutions += 1;
        continue;
      }
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!isValidCoordinate(latitude, longitude)) {
        withoutCoordinates += 1;
        continue;
      }
      points.push({
        id: row.id,
        name: row.name,
        detail: row.regionName ?? "",
        latitude,
        longitude,
        approved: row.approved,
        href: hrefFor(user, filters.period, { id: row.id, name: row.name }),
      });
    }

    return {
      level,
      period: filters.period,
      points,
      totals: {
        approved,
        institutions,
        locations: points.length,
        zeroInstitutions,
        withoutCoordinates,
      },
      truncated,
      generatedAt: new Date(),
    };
  }

  const rows = await db
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      category: schema.stakeholders.category,
      latitude: schema.stakeholders.latitude,
      longitude: schema.stakeholders.longitude,
      branchName: schema.branchOffices.name,
      approved: sql<number>`coalesce(${approvedAgg.approved}, 0)`.mapWith(
        Number,
      ),
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .leftJoin(
      approvedAgg,
      eq(approvedAgg.stakeholderId, schema.stakeholders.id),
    )
    .where(institutionWhere)
    .orderBy(
      desc(sql`coalesce(${approvedAgg.approved}, 0)`),
      asc(schema.stakeholders.name),
    )
    .limit(DASHBOARD_MAP_LIMIT + 1);

  const truncated = rows.length > DASHBOARD_MAP_LIMIT;
  const visible = rows.slice(0, DASHBOARD_MAP_LIMIT);
  let approved = 0;
  let zeroInstitutions = 0;
  let withoutCoordinates = 0;
  const points: DashboardMapPoint[] = [];
  for (const row of visible) {
    approved += row.approved;
    if (row.approved === 0) {
      zeroInstitutions += 1;
      continue;
    }
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      withoutCoordinates += 1;
      continue;
    }
    points.push({
      id: row.id,
      name: row.name,
      detail: row.branchName ?? row.category,
      latitude,
      longitude,
      approved: row.approved,
      href: hrefFor(user, filters.period, { id: row.id, name: row.name }),
    });
  }

  return {
    level,
    period: filters.period,
    points,
    totals: {
      approved,
      institutions: visible.length,
      locations: points.length,
      zeroInstitutions,
      withoutCoordinates,
    },
    truncated,
    generatedAt: new Date(),
  };
}
