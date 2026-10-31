import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb, schema } from "@/db";
import { organizationScopePredicate } from "@/lib/authz/predicates";
import type { SessionUser } from "@/lib/session";

export const ORG_SOURCES = [
  "FASKES_FKTP",
  "FASKES_FKRTL",
  "PEMDA",
  "OTHER",
] as const;

export type OrgSource = (typeof ORG_SOURCES)[number];

export const ORG_SOURCE_LABELS: Record<OrgSource, string> = {
  FASKES_FKTP: "Faskes FKTP",
  FASKES_FKRTL: "Faskes FKRTL",
  PEMDA: "Pemda",
  OTHER: "Stakeholder/Mitra",
};

export function sourceOfOrganization(organization: {
  organizationType: string;
  faskesClass: string | null;
}): OrgSource {
  if (organization.organizationType === "FASKES") {
    return organization.faskesClass === "FKRTL" ? "FASKES_FKRTL" : "FASKES_FKTP";
  }
  if (organization.organizationType === "PEMDA") return "PEMDA";
  return "OTHER";
}

export function isOrgSource(value: string): value is OrgSource {
  return (ORG_SOURCES as readonly string[]).includes(value);
}

export function parseOrgSources(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): OrgSource[] {
  const raw =
    params instanceof URLSearchParams
      ? [
          ...params.getAll("source"),
          ...(params.get("source")?.split(",") ?? []),
        ]
      : Array.isArray(params.source)
        ? params.source.flatMap((value) => value.split(","))
        : (params.source?.split(",") ?? []);
  const unique = new Set<OrgSource>();
  for (const value of raw) {
    const trimmed = value.trim().toUpperCase();
    if (isOrgSource(trimmed)) unique.add(trimmed);
  }
  return ORG_SOURCES.filter((source) => unique.has(source));
}

function sourceValues(sources: readonly OrgSource[]): Array<{
  organizationType: string;
  faskesClass: string | null;
}> {
  return sources.map((source) => {
    switch (source) {
      case "FASKES_FKTP":
        return { organizationType: "FASKES", faskesClass: "FKTP" };
      case "FASKES_FKRTL":
        return { organizationType: "FASKES", faskesClass: "FKRTL" };
      case "PEMDA":
        return { organizationType: "PEMDA", faskesClass: null };
      case "OTHER":
        return { organizationType: "OTHER", faskesClass: null };
    }
  });
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
  const matching = sourceValues(sources).map((value) =>
    value.faskesClass
      ? and(
          eq(schema.stakeholders.organizationType, value.organizationType),
          eq(schema.stakeholders.faskesClass, value.faskesClass),
        )
      : eq(schema.stakeholders.organizationType, value.organizationType),
  );
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
    .where(
      and(
        scope,
        isNotNull(schema.stakeholders.organizationType),
      ),
    )
    .groupBy(
      schema.stakeholders.organizationType,
      schema.stakeholders.faskesClass,
    )
    .orderBy(asc(schema.stakeholders.organizationType));

  const totals = new Map<OrgSource, { organizations: number; active: number }>();
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
