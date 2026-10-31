export type AppRole =
  | "MASTER_ADMIN"
  | "REGIONAL_ADMIN"
  | "BRANCH_ADMIN"
  | "STAKEHOLDER";

export const APP_ROLES: readonly AppRole[] = [
  "MASTER_ADMIN",
  "REGIONAL_ADMIN",
  "BRANCH_ADMIN",
  "STAKEHOLDER",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  MASTER_ADMIN: "Master Admin",
  REGIONAL_ADMIN: "Admin Wilayah",
  BRANCH_ADMIN: "Admin Cabang",
  STAKEHOLDER: "Stakeholder",
};

export type Scope =
  | { kind: "GLOBAL" }
  | {
      kind: "REGION";
      regionId: string;
      branchIds: readonly string[];
      regionName: string;
    }
  | {
      kind: "BRANCH";
      branchId: string;
      regionId: string;
      branchName: string;
      regionName: string;
    }
  | {
      kind: "ORG";
      organizationId: string;
      organizationName: string;
      branchId: string | null;
      branchName: string | null;
      regionId: string | null;
      regionName: string | null;
    };

export type Capability =
  | "hierarchy:read"
  | "hierarchy:manage"
  | "organization:read"
  | "organization:manage"
  | "account:read"
  | "account:manage"
  | "account:reset"
  | "import:manage"
  | "content:create"
  | "content:read"
  | "content:update_own"
  | "content:submit"
  | "content:review"
  | "content:override"
  | "content:revoke"
  | "policy:read"
  | "policy:manage"
  | "analytics:read"
  | "rednotice:read"
  | "map:read"
  | "export:read"
  | "audit:read"
  | "notification:read"
  | "target:manage"
  | "demo:reset";

export type AuthContext = {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  scope: Scope;
  capabilities: readonly Capability[];
  isDemo: boolean;
  mustChangePassword: boolean;
  displayTitle: string | null;
  membershipId: string;
  homePath: string;
  scopeLabel: string;
};

export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "MASTER_ADMIN":
      return "/admin";
    case "REGIONAL_ADMIN":
      return "/wilayah";
    case "BRANCH_ADMIN":
      return "/cabang";
    case "STAKEHOLDER":
      return "/client";
  }
}

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}
