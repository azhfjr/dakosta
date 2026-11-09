import "server-only";

import { and, asc, count, desc, eq, ne, type SQL } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { recordAudit } from "@/lib/audit";
import {
  contentScopePredicate,
  isOrganizationInScope,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import { normalizeStatus, type ContentStatus } from "@/lib/content-status";
import { errors } from "@/lib/errors";
import { isValidCoordinate } from "@/lib/geo";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import { isSubTheme, SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";

export const MAP_STATUSES = [
  "ALL",
  "APPROVED",
  "SUBMITTED",
  "REVISION_REQUIRED",
] as const;

export type MapStatus = (typeof MAP_STATUSES)[number];

export type MapFilters = {
  stakeholderId: string | null;
  subTheme: SubTheme | null;
  status: MapStatus;
};

export type MapPoint = {
  id: string;
  referenceCode: string;
  title: string | null;
  status: ContentStatus;
  platform: string;
  stakeholderId: string;
  stakeholderName: string;
  subTheme: SubTheme | null;
  themeName: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  locationSource: string;
  precision: "exact" | "approximate";
  accuracyMeters: number | null;
  approvedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  href: string;
};

export type MapSite = {
  id: string;
  name: string;
  category: string;
  serviceArea: string;
  latitude: number;
  longitude: number;
  precision: "exact" | "approximate";
  submissionCount: number;
  href: string;
};

export type MapOverview = {
  filters: MapFilters;
  points: MapPoint[];
  sites: MapSite[];
  totals: {
    points: number;
    exactPoints: number;
    approximatePoints: number;
    sites: number;
    stakeholdersRepresented: number;
  };
  truncated: boolean;
  generatedAt: Date;
};

export const MAP_POINT_LIMIT = 500;

function isMapStatus(value: unknown): value is MapStatus {
  return (
    typeof value === "string" &&
    (MAP_STATUSES as readonly string[]).includes(value)
  );
}

export function parseMapFilters(
  params: Record<string, string | string[] | undefined>,
): MapFilters {
  const read = (key: string): string | undefined => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const stakeholderId = read("stakeholderId");
  const subTheme = read("subTheme");
  const status = read("status");

  return {
    stakeholderId:
      stakeholderId && uuid.test(stakeholderId) ? stakeholderId : null,
    subTheme: isSubTheme(subTheme) ? subTheme : null,
    status: isMapStatus(status) ? status : "ALL",
  };
}

export function parseMapFiltersFromQuery(
  searchParams: URLSearchParams,
): MapFilters {
  return parseMapFilters(Object.fromEntries(searchParams.entries()));
}

function precisionOf(value: string): "exact" | "approximate" {
  return value === "exact" ? "exact" : "approximate";
}

function scopeConditions(user: SessionUser, filters: MapFilters): SQL[] {
  const conditions: SQL[] = [eq(schema.contentSubmissions.archived, false)];
  conditions.push(ne(schema.contentSubmissions.status, "DRAFT"));

  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scopePredicate) conditions.push(scopePredicate);

  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }
  if (filters.status !== "ALL") {
    conditions.push(eq(schema.contentSubmissions.status, filters.status));
  }

  return conditions;
}

function siteConditions(user: SessionUser, filters: MapFilters): SQL[] {
  const conditions: SQL[] = [eq(schema.stakeholders.status, "ACTIVE")];
  const scopePredicate = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });
  if (scopePredicate) conditions.push(scopePredicate);
  if (filters.stakeholderId) {
    conditions.push(eq(schema.stakeholders.id, filters.stakeholderId));
  }
  return conditions;
}

function whereAll(...parts: SQL[]): SQL | undefined {
  if (parts.length === 0) return undefined;
  return and(...parts);
}

export async function getMapOverview(
  user: SessionUser,
  filters: MapFilters,
): Promise<MapOverview> {
  return cachedRead(
    readCacheKey(user, [
      "map-overview",
      filters.stakeholderId,
      filters.subTheme,
      filters.status,
    ]),
    () => loadMapOverview(user, filters),
  );
}

async function loadMapOverview(
  user: SessionUser,
  filters: MapFilters,
): Promise<MapOverview> {
  if (filters.stakeholderId) {
    const [organization] = await getDb()
      .select({
        id: schema.stakeholders.id,
        branchOfficeId: schema.stakeholders.branchOfficeId,
      })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.id, filters.stakeholderId))
      .limit(1);
    if (!organization || !isOrganizationInScope(user.scope, organization)) {
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "ACCESS_DENIED",
        recordType: "ORGANIZATION",
        recordId: filters.stakeholderId,
        after: { reason: "organization_scope_mismatch", route: "/peta" },
      });
      throw errors.forbidden(
        "Anda tidak memiliki akses ke organisasi tersebut.",
      );
    }
  }

  const db = getDb();
  const scoped = whereAll(...scopeConditions(user, filters));

  const [pointRows, countRows, siteRows] = await Promise.all([
    db
      .select({
        id: schema.contentSubmissions.id,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        status: schema.contentSubmissions.status,
        platform: schema.contentSubmissions.platform,
        stakeholderId: schema.contentSubmissions.stakeholderId,
        stakeholderName: schema.stakeholders.name,
        subTheme: schema.contentSubmissions.subTheme,
        themeName: schema.themes.name,
        latitude: schema.locations.latitude,
        longitude: schema.locations.longitude,
        locationLabel: schema.locations.label,
        locationSource: schema.locations.source,
        precision: schema.locations.precision,
        accuracyMeters: schema.locations.accuracyMeters,
        approvedAt: schema.contentSubmissions.approvedAt,
        submittedAt: schema.contentSubmissions.submittedAt,
        updatedAt: schema.contentSubmissions.updatedAt,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.locations,
        eq(schema.locations.id, schema.contentSubmissions.locationId),
      )
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .leftJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(scoped)
      .orderBy(desc(schema.contentSubmissions.updatedAt))
      .limit(MAP_POINT_LIMIT + 1),
    db
      .select({
        status: schema.contentSubmissions.status,
        precision: schema.locations.precision,
        total: count(),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.locations,
        eq(schema.locations.id, schema.contentSubmissions.locationId),
      )
      .where(scoped)
      .groupBy(schema.contentSubmissions.status, schema.locations.precision),
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        category: schema.stakeholders.category,
        serviceArea: schema.stakeholders.serviceArea,
        latitude: schema.stakeholders.latitude,
        longitude: schema.stakeholders.longitude,
        precision: schema.stakeholders.locationPrecision,
      })
      .from(schema.stakeholders)
      .where(whereAll(...siteConditions(user, filters)))
      .orderBy(asc(schema.stakeholders.name)),
  ]);

  const truncated = pointRows.length > MAP_POINT_LIMIT;
  const points = pointRows
    .slice(0, MAP_POINT_LIMIT)
    .filter((row) =>
      isValidCoordinate(Number(row.latitude), Number(row.longitude)),
    )
    .map<MapPoint>((row) => {
      const status = normalizeStatus(row.status);
      const subTheme = isSubTheme(row.subTheme) ? row.subTheme : null;
      return {
        id: row.id,
        referenceCode: row.referenceCode,
        title: row.title,
        status,
        platform: row.platform,
        stakeholderId: row.stakeholderId,
        stakeholderName: row.stakeholderName,
        subTheme,
        themeName:
          row.themeName ??
          (subTheme ? SUB_THEME_LABELS[subTheme] : "Tanpa tema"),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        locationLabel: row.locationLabel,
        locationSource: row.locationSource,
        precision: precisionOf(row.precision),
        accuracyMeters:
          row.accuracyMeters == null ? null : Number(row.accuracyMeters),
        approvedAt: row.approvedAt?.toISOString() ?? null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        href:
          user.role === "MASTER_ADMIN"
            ? `/admin/validasi/${row.id}`
            : user.role === "BRANCH_ADMIN"
              ? `/cabang/review/${row.id}`
              : user.role === "REGIONAL_ADMIN"
                ? `/wilayah/konten/${row.id}`
                : `/client/konten/${row.id}`,
      };
    });

  const countsByStakeholder = new Map<string, number>();
  for (const row of points) {
    countsByStakeholder.set(
      row.stakeholderId,
      (countsByStakeholder.get(row.stakeholderId) ?? 0) + 1,
    );
  }

  const sites = siteRows
    .filter((row) =>
      isValidCoordinate(Number(row.latitude), Number(row.longitude)),
    )
    .map<MapSite>((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      serviceArea: row.serviceArea,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      precision: precisionOf(row.precision),
      submissionCount: countsByStakeholder.get(row.id) ?? 0,
      href:
        user.role === "MASTER_ADMIN"
          ? `/admin/validasi?stakeholderId=${row.id}`
          : user.role === "BRANCH_ADMIN"
            ? `/cabang/organisasi`
            : user.role === "REGIONAL_ADMIN"
              ? `/wilayah/organisasi`
              : `/client/konten`,
    }));

  const totals = {
    points: 0,
    exactPoints: 0,
    approximatePoints: 0,
    sites: sites.length,
    stakeholdersRepresented: countsByStakeholder.size,
  };
  for (const row of countRows) {
    const total = Number(row.total);
    totals.points += total;
    if (precisionOf(row.precision) === "exact") {
      totals.exactPoints += total;
    } else {
      totals.approximatePoints += total;
    }
  }

  return {
    filters,
    points,
    sites,
    totals,
    truncated,
    generatedAt: new Date(),
  };
}
