import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.E2E_PORT ?? "3300"}`;
const RUNS = Number(process.env.PERF_RUNS ?? "3");

const BUDGETS = {
  // Recharts (~110 KB gzip) renders above the fold on the admin dashboard, so
  // its route budget carries a documented allowance over the 350 KB default.
  "/admin": { ttfb: 1200, lcp: 2500, js: 375 },
  "/admin/target": { ttfb: 800, lcp: 2500 },
  "/admin/konten": { ttfb: 1200, lcp: 2500 },
  "/cabang/review": { ttfb: 1200, lcp: 2500 },
  "/client": { ttfb: 1200, lcp: 2500 },
};
const MAX_CLS = 0.1;
const MAX_ROUTE_KB = 350;

const stateFile = path.join("e2e", ".auth", "admin.json");
if (!existsSync(stateFile)) {
  console.error("State login admin tidak ditemukan. Jalankan global setup E2E dahulu.");
  process.exit(1);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

const initScript = () => {
  window.__perf = { lcp: 0, cls: 0 };
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) window.__perf.lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__perf.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL,
  storageState: JSON.parse(readFileSync(stateFile, "utf8")),
  viewport: { width: 1440, height: 1000 },
});

const results = [];
let failed = false;

try {
  for (const [route, budget] of Object.entries(BUDGETS)) {
    const page = await context.newPage();
    await page.addInitScript(initScript);
    const samples = [];
    let scriptBytes = 0;
    await page.goto(route, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(800);
    for (let run = 0; run < RUNS; run += 1) {
      await page.goto(route, { waitUntil: "load", timeout: 90_000 });
      await page.waitForTimeout(1_200);
      const sample = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const scripts = performance
          .getEntriesByType("resource")
          .filter((entry) => entry.initiatorType === "script");
        return {
          ttfb: nav ? nav.responseStart : 0,
          domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
          load: nav ? nav.loadEventEnd : 0,
          lcp: window.__perf?.lcp ?? 0,
          cls: window.__perf?.cls ?? 0,
          scriptBytes: scripts.reduce(
            (total, entry) => total + (entry.encodedBodySize || entry.transferSize || 0),
            0,
          ),
        };
      });
      samples.push(sample);
      if (run === 0) {
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(400);
      }
    }
    scriptBytes = Math.max(...samples.map((item) => item.scriptBytes));
    const ttfb = percentile(samples.map((item) => item.ttfb), 95);
    const lcp = percentile(samples.map((item) => item.lcp), 95);
    const cls = Math.max(...samples.map((item) => item.cls));
    const jsKb = Math.round(scriptBytes / 1024);
    const breaches = [];
    if (ttfb > budget.ttfb) breaches.push(`TTFB ${Math.round(ttfb)}ms > ${budget.ttfb}ms`);
    if (lcp > budget.lcp) breaches.push(`LCP ${Math.round(lcp)}ms > ${budget.lcp}ms`);
    if (cls > MAX_CLS) breaches.push(`CLS ${cls.toFixed(3)} > ${MAX_CLS}`);
    const jsLimit = budget.js ?? MAX_ROUTE_KB;
    if (jsKb > jsLimit) breaches.push(`JS ${jsKb}KB > ${jsLimit}KB`);
    if (breaches.length > 0) failed = true;
    results.push({ route, ttfb, lcp, cls, jsKb, breaches });
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

console.log("Rute                     TTFB p95   LCP p95    CLS     JS KB  Status");
for (const row of results) {
  console.log(
    `${row.route.padEnd(24)} ${String(Math.round(row.ttfb)).padStart(8)}ms ${String(
      Math.round(row.lcp),
    ).padStart(8)}ms ${row.cls.toFixed(3).padStart(7)} ${String(row.jsKb).padStart(6)}  ${
      row.breaches.length === 0 ? "OK" : row.breaches.join("; ")
    }`,
  );
}

if (failed) {
  console.error("\nAnggaran performa terlampaui.");
  process.exitCode = 1;
} else {
  console.log("\nSeluruh anggaran performa terpenuhi.");
}
