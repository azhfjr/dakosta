import { execSync } from "node:child_process";

import { baseURL, shouldResetDatabase } from "./support";

export default async function globalTeardown(): Promise<void> {
  if (!shouldResetDatabase) {
    console.warn(`[e2e] Data uji tidak direset otomatis (${baseURL}).`);
    return;
  }

  console.log("[e2e] Memulihkan basis data staging setelah pengujian.");
  execSync("npm run db:reset:staging", { stdio: "inherit" });
}
