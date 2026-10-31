import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { request } from "@playwright/test";

import { baseURL, databaseTarget, shouldResetDatabase } from "../e2e/support";

const AUTH_DIR = path.join("e2e", ".auth-empty");

export default async function globalSetup(): Promise<void> {
  if (!shouldResetDatabase) {
    throw new Error(
      "Suite kondisi kosong membutuhkan E2E_ALLOW_DB_RESET=yes pada server lokal dengan basis data staging.",
    );
  }
  if (databaseTarget !== "staging") {
    throw new Error("Reset basis data kosong hanya diizinkan dengan E2E_DB_TARGET=staging.");
  }

  console.log("[e2e-empty] Mengosongkan basis data staging dan membuat satu Master Admin.");
  execSync("npm run db:reset:staging -- --empty", { stdio: "inherit" });

  rmSync(AUTH_DIR, { recursive: true, force: true });
  mkdirSync(AUTH_DIR, { recursive: true });

  const context = await request.newContext({ baseURL });
  try {
    const response = await context.post("/api/v1/demo/login", {
      data: { role: "admin" },
    });
    if (!response.ok()) {
      throw new Error(`Login demo admin gagal (${response.status()}).`);
    }
    await context.storageState({ path: path.join(AUTH_DIR, "admin.json") });
  } finally {
    await context.dispose();
  }
  console.log("[e2e-empty] Sesi Master tersimpan.");
}
