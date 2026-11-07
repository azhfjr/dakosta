export const ORG_TYPE_FILTERS = ["FASKES", "PEMDA", "OTHER"] as const;
export type OrgTypeFilter = (typeof ORG_TYPE_FILTERS)[number];

export const ORG_TYPE_FILTER_LABELS: Record<OrgTypeFilter, string> = {
  FASKES: "Faskes",
  PEMDA: "Pemda",
  OTHER: "Stakeholder lainnya",
};

export function isOrgTypeFilter(value: unknown): value is OrgTypeFilter {
  return (
    typeof value === "string" &&
    (ORG_TYPE_FILTERS as readonly string[]).includes(value)
  );
}

export function parseOrgType(value: string | undefined): OrgTypeFilter | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return isOrgTypeFilter(upper) ? upper : null;
}
