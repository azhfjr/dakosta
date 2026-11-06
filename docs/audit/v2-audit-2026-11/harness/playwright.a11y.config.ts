import path from "node:path";

import { defineConfig } from "@playwright/test";

const baseURL = (
  process.env.A11Y_BASE_URL ?? "https://dakosta-dakosta.vercel.app"
).replace(/\/+$/, "");

export default defineConfig({
  testDir: __dirname,
  testMatch: /a11y-wcag22\.spec\.ts/,
  outputDir: path.join(__dirname, ".results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
