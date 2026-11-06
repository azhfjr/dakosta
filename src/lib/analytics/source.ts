import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb, schema } from "@/db";
import { organizationScopePredicate } from "@/lib/authz/predicates";
import type { SessionUser } from "@/lib/session";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  isOrgSource,
  parseOrgSources,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/org-source";

export {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  isOrgSource,
  parseOrgSources,
  sourceOfOrganization,
  type OrgSource,
};

function sourcePredicate(source: OrgSource): SQL {
  switch (source) {
    case "FASKES_FKTP":
      // Faskes tanpa kelas tercatat dihitung sebagai FKTP oleh
      // sourceOfOrganization, jadi filter harus menyertakannya juga.
      return and(
        eq(schema.stakeholders.organizationType, "FASKES"),
        or(
          eq(schema.stakeholders.faskesClass, "FKTP"),
          isNull(schema.stakeholders.faskesClass),
        ),
      )!;
    case "FASKES_FKRTL":
      return and(
        eq(schema.stakeholders.organizationType, "FASKES"),
        eq(schema.stakeholders.faskesClass, "FKRTL"),
      )!;
    case "PEMDA":
      return eq(schema.stakeholders.organizationType, "PEMDA");
    case "OTHER":
      return eq(schema.stakeholders.organizationType, "OTHER");
  }
}

/**
 * Restricts an organization column to the selected input sources without an
 * extra join. An empty selection means "all sources".
 */
export function orgSourceCondition(
  organizationIdColumn: AnyPgColumn,
  sources: readonly OrgSource[],
): SQL | undefined {
  if (sources.length === 0) return undefined;
  const db = getDb();
  const matching = sources.map(sourcePredicate);
  const predicate = matching.length === 1 ? matching[0] : or(...matching);
  return inArray(
    organizationIdColumn,
    db
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(predicate),
  );
}

export type AnalyticsSourceOption = {
  source: OrgSource;
  label: string;
  organizations: number;
  active: number;
};

export async function getAnalyticsSourceOptions(
  user: SessionUser,
): Promise<AnalyticsSourceOption[]> {
  const scope = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });

  const rows = await getDb()
    .select({
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
      organizations: count(),
      active: sql<number>`count(*) filter (where ${schema.stakeholders.status} = 'ACTIVE')`,
    })
    .from(schema.stakeholders)
    .where(and(scope, isNotNull(schema.stakeholders.organizationType)))
    .groupBy(
      schema.stakeholders.organizationType,
      schema.stakeholders.faskesClass,
    )
    .orderBy(asc(schema.stakeholders.organizationType));

  const totals = new Map<
    OrgSource,
    { organizations: number; active: number }
  >();
  for (const row of rows) {
    const source = sourceOfOrganization({
      organizationType: row.organizationType,
      faskesClass: row.faskesClass,
    });
    const current = totals.get(source) ?? { organizations: 0, active: 0 };
    current.organizations += Number(row.organizations);
    current.active += Number(row.active);
    totals.set(source, current);
  }

  return ORG_SOURCES.filter((source) => totals.has(source)).map((source) => ({
    source,
    label: ORG_SOURCE_LABELS[source],
    organizations: totals.get(source)?.organizations ?? 0,
    active: totals.get(source)?.active ?? 0,
  }));
}
