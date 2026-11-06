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
    return organization.faskesClass === "FKRTL"
      ? "FASKES_FKRTL"
      : "FASKES_FKTP";
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
