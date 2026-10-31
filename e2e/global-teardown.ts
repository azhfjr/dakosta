import { execSync } from "node:child_process";

import { baseURL, isLocalTarget } from "./support";

export default async function globalTeardown(): Promise<void> {
  if (!isLocalTarget(baseURL)) {
    console.warn("[e2e] Target bukan lokal; data uji tidak direset otomatis.");
    return;
  }

  console.log("[e2e] Memulihkan basis data demo setelah pengujian.");
  execSync("npm run db:reset", { stdio: "inherit" });
}
