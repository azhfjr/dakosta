import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT ?? "3300";
const e2eOrigin = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e-empty",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./e2e-empty/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? e2eOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
    storageState: "e2e/.auth-empty/admin.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev:e2e",
        url: `${e2eOrigin}/api/health`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { PORT: E2E_PORT },
      },
});
