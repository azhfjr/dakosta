import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { request } from "@playwright/test";

import {
  baseURL,
  databaseTarget,
  DEMO_ROLES,
  sameOriginHeaders,
  shouldResetDatabase,
  stateFor,
} from "./support";

export default async function globalSetup(): Promise<void> {
  if (shouldResetDatabase) {
    if (databaseTarget !== "staging") {
      throw new Error(
        "E2E_ALLOW_DB_RESET hanya diizinkan dengan E2E_DB_TARGET=staging. Tidak ada perubahan yang dilakukan.",
      );
    }
    console.log("[e2e] Mereset basis data staging ke kondisi demo awal.");
    execSync("npm run db:reset:staging", { stdio: "inherit" });
  } else {
    console.warn(
      `[e2e] Reset basis data dilewati (target=${baseURL}, E2E_ALLOW_DB_RESET=${
        process.env.E2E_ALLOW_DB_RESET === "yes" ? "yes" : "tidak diset"
      }).`,
    );
  }

  rmSync("e2e/.auth", { recursive: true, force: true });
  mkdirSync("e2e/.auth", { recursive: true });

  for (const role of DEMO_ROLES) {
    const context = await request.newContext({ baseURL });
    try {
      const response = await context.post("/api/v1/demo/login", {
        data: { role },
        headers: sameOriginHeaders,
      });
      if (!response.ok()) {
        throw new Error(
          `Login demo ${role} gagal (${response.status()}): ${await response.text()}`,
        );
      }
      await context.storageState({ path: stateFor(role) });
    } finally {
      await context.dispose();
    }
  }

  console.log(`[e2e] Sesi demo tersimpan: ${DEMO_ROLES.join(", ")}.`);
}
