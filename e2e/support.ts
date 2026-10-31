import path from "node:path";

export const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const AUTH_DIR = path.join("e2e", ".auth");
export const ADMIN_STATE = path.join(AUTH_DIR, "admin.json");
export const CLIENT_STATE = path.join(AUTH_DIR, "client.json");

export function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(url);
}
