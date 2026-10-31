import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";

import { ADMIN_STATE, AUTH_DIR, CLIENT_STATE, baseURL, isLocalTarget } from "./support";

export default async function globalSetup(): Promise<void> {
  if (isLocalTarget(baseURL)) {
    console.log("[e2e] Mereset basis data demo ke kondisi awal.");
    execSync("npm run db:reset", { stdio: "inherit" });
  } else {
    console.warn(`[e2e] Target bukan lokal (${baseURL}); reset basis data dilewati.`);
  }

  rmSync(AUTH_DIR, { recursive: true, force: true });
  mkdirSync(AUTH_DIR, { recursive: true });

  const targets = [
    { role: "admin" as const, state: ADMIN_STATE },
    { role: "client" as const, state: CLIENT_STATE },
  ];

  for (const target of targets) {
    const context = await request.newContext({ baseURL });
    try {
      const response = await context.post("/api/v1/demo/login", {
        data: { role: target.role },
      });
      if (!response.ok()) {
        throw new Error(
          `Login demo ${target.role} gagal (${response.status()}): ${await response.text()}`,
        );
      }
      await context.storageState({ path: path.resolve(target.state) });
    } finally {
      await context.dispose();
    }
  }

  console.log("[e2e] Sesi demo admin dan klien tersimpan.");
}
