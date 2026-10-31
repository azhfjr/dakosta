import { describe, expect, it } from "vitest";

import { isOrganizationInScope } from "@/lib/authz/predicates";
import type { Scope } from "@/lib/authz/types";

const ORGANIZATION = {
  regionOrg: { id: "org-a", branchOfficeId: "branch-a1" },
  siblingOrg: { id: "org-b", branchOfficeId: "branch-b1" },
  unassignedOrg: { id: "org-c", branchOfficeId: null },
};

const ORG_SCOPE: Scope = {
  kind: "ORG",
  organizationId: "org-a",
  organizationName: "Faskes A",
  branchId: "branch-a1",
  branchName: "Cabang A1",
  regionId: "region-1",
  regionName: "Wilayah 1",
};

const BRANCH_SCOPE: Scope = {
  kind: "BRANCH",
  branchId: "branch-a1",
  regionId: "region-1",
  branchName: "Cabang A1",
  regionName: "Wilayah 1",
};

const REGION_SCOPE: Scope = {
  kind: "REGION",
  regionId: "region-1",
  branchIds: ["branch-a1"],
  regionName: "Wilayah 1",
};

const EMPTY_REGION_SCOPE: Scope = {
  kind: "REGION",
  regionId: "region-empty",
  branchIds: [],
  regionName: "Wilayah kosong",
};

describe("organization scope predicate", () => {
  it("global scope matches everything", () => {
    expect(isOrganizationInScope({ kind: "GLOBAL" }, ORGANIZATION.regionOrg)).toBe(true);
    expect(isOrganizationInScope({ kind: "GLOBAL" }, ORGANIZATION.unassignedOrg)).toBe(true);
  });

  it("organization scope matches only its own organization", () => {
    expect(isOrganizationInScope(ORG_SCOPE, ORGANIZATION.regionOrg)).toBe(true);
    expect(isOrganizationInScope(ORG_SCOPE, ORGANIZATION.siblingOrg)).toBe(false);
  });

  it("branch scope matches organizations inside the branch only", () => {
    expect(isOrganizationInScope(BRANCH_SCOPE, ORGANIZATION.regionOrg)).toBe(true);
    expect(isOrganizationInScope(BRANCH_SCOPE, ORGANIZATION.siblingOrg)).toBe(false);
  });

  it("region scope enumerates branches and never leaks unassigned organizations", () => {
    expect(isOrganizationInScope(REGION_SCOPE, ORGANIZATION.regionOrg)).toBe(true);
    expect(isOrganizationInScope(REGION_SCOPE, ORGANIZATION.siblingOrg)).toBe(false);
    expect(isOrganizationInScope(REGION_SCOPE, ORGANIZATION.unassignedOrg)).toBe(false);
  });

  it("an empty region branch list matches nothing", () => {
    expect(isOrganizationInScope(EMPTY_REGION_SCOPE, ORGANIZATION.regionOrg)).toBe(false);
    expect(isOrganizationInScope(EMPTY_REGION_SCOPE, ORGANIZATION.unassignedOrg)).toBe(false);
  });
});
