import path from "node:path";

export const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const AUTH_DIR = path.join("e2e", ".auth");

export type DemoRole =
  | "admin"
  | "regional"
  | "regionalB"
  | "branch"
  | "branchA2"
  | "branchB1"
  | "client";

export const DEMO_ROLES: DemoRole[] = [
  "admin",
  "regional",
  "regionalB",
  "branch",
  "branchA2",
  "branchB1",
  "client",
];

const STATE_FILES: Record<DemoRole, string> = {
  admin: "admin.json",
  regional: "regional.json",
  regionalB: "regional-b.json",
  branch: "branch-a1.json",
  branchA2: "branch-a2.json",
  branchB1: "branch-b1.json",
  client: "client.json",
};

export function stateFor(role: DemoRole): string {
  return path.join(AUTH_DIR, STATE_FILES[role]);
}

export const ADMIN_STATE = stateFor("admin");
export const REGIONAL_STATE = stateFor("regional");
export const REGIONAL_B_STATE = stateFor("regionalB");
export const BRANCH_STATE = stateFor("branch");
export const BRANCH_A2_STATE = stateFor("branchA2");
export const BRANCH_B1_STATE = stateFor("branchB1");
export const CLIENT_STATE = stateFor("client");

export function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(url);
}

/**
 * Seeding is destructive. It is only enabled for a local rehearsal server
 * whose database is the dedicated staging branch, never `.env.local`.
 */
export const shouldResetDatabase =
  isLocalTarget(baseURL) && process.env.E2E_ALLOW_DB_RESET === "yes";

export const databaseTarget = process.env.E2E_DB_TARGET ?? "staging";
