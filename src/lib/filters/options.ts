import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { ORG_SOURCES, ORG_SOURCE_LABELS } from "@/lib/analytics/org-source";
import {
  branchScopePredicate,
  organizationScopePredicate,
  regionScopePredicate,
} from "@/lib/authz/predicates";
import { CONTENT_STATUSES, STATUS_LABEL } from "@/lib/content-status";
import type { FilterOption } from "@/lib/filters/query";
import { monthRange, recentMonthKeys } from "@/lib/kpi/formulas";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  MAIN_THEMES,
  MAIN_THEME_LABELS,
  SUB_THEMES,
  SUB_THEME_LABELS,
} from "@/lib/taxonomy";

export type FilterOptions = {
  stakeholders: FilterOption[];
  branches: FilterOption[];
  regions: FilterOption[];
  subThemes: FilterOption[];
  mainThemes: FilterOption[];
  contentTypes: FilterOption[];
  sources: FilterOption[];
  statuses: FilterOption[];
  periods: FilterOption[];
};

export const PERIOD_OPTION_COUNT = 24;

/**
 * Role-scoped filter options shared by every dashboard and list page. Cached
 * per user so a page that renders several filter bars issues one query set.
 */
export async function getFilterOptions(
  user: SessionUser,
): Promise<FilterOptions> {
  return cachedRead(
    readCacheKey(user, ["filter-options", PERIOD_OPTION_COUNT]),
    () => loadFilterOptions(user),
    { ttlMs: 300_000, maxStaleMs: 300_000 },
  );
}

async function loadFilterOptions(user: SessionUser): Promise<FilterOptions> {
  const db = getDb();

  const [stakeholderRows, branchRows, regionRows] = await Promise.all([
    db
      .select({ id: schema.stakeholders.id, name: schema.stakeholders.name })
      .from(schema.stakeholders)
      .where(
        and(
          eq(schema.stakeholders.status, "ACTIVE"),
          organizationScopePredicate(user.scope, {
            id: schema.stakeholders.id,
            branchId: schema.stakeholders.branchOfficeId,
          }),
        ),
      )
      .orderBy(asc(schema.stakeholders.name)),
    db
      .select({
        id: schema.branchOffices.id,
        name: schema.branchOffices.name,
      })
      .from(schema.branchOffices)
      .where(
        and(
          eq(schema.branchOffices.status, "ACTIVE"),
          branchScopePredicate(user.scope, schema.branchOffices.id),
        ),
      )
      .orderBy(asc(schema.branchOffices.name)),
    db
      .select({
        id: schema.regionalOffices.id,
        name: schema.regionalOffices.name,
      })
      .from(schema.regionalOffices)
      .where(
        and(
          eq(schema.regionalOffices.status, "ACTIVE"),
          regionScopePredicate(user.scope, schema.regionalOffices.id),
        ),
      )
      .orderBy(asc(schema.regionalOffices.name)),
  ]);

  return {
    stakeholders: stakeholderRows.map((row) => ({
      value: row.id,
      label: row.name,
    })),
    branches: branchRows.map((row) => ({ value: row.id, label: row.name })),
    regions: regionRows.map((row) => ({ value: row.id, label: row.name })),
    subThemes: SUB_THEMES.map((value) => ({
      value,
      label: SUB_THEME_LABELS[value],
    })),
    mainThemes: MAIN_THEMES.map((value) => ({
      value,
      label: MAIN_THEME_LABELS[value],
    })),
    contentTypes: CONTENT_TYPES.map((value) => ({
      value,
      label: CONTENT_TYPE_LABELS[value],
    })),
    sources: ORG_SOURCES.map((value) => ({
      value,
      label: ORG_SOURCE_LABELS[value],
    })),
    statuses: CONTENT_STATUSES.map((value) => ({
      value,
      label: STATUS_LABEL[value],
    })),
    periods: recentMonthKeys(new Date(), PERIOD_OPTION_COUNT).map((key) => ({
      value: key,
      label: monthRange(key).label,
    })),
  };
}
