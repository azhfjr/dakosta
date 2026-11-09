import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3400";
const outDir = join("docs", "audit", "evidence", "ui-v35", "pdf");
const roleFilter = (process.env.CAPTURE_ROLES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function log(message) {
  const elapsed = Math.round(process.uptime() * 1000);
  process.stdout.write(`[${elapsed}ms] ${message}\n`);
}

const TARGETS = [
  { name: "master", path: "/admin", state: "admin.json" },
  { name: "regional", path: "/wilayah/dashboard", state: "regional.json" },
  { name: "branch", path: "/cabang/dashboard", state: "branch-a1.json" },
  { name: "stakeholder", path: "/client", state: "client.json" },
].filter(
  (target) => roleFilter.length === 0 || roleFilter.includes(target.name),
);

function pngSize(buffer) {
  if (buffer.subarray(1, 4).toString() !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function exportVariant(page, target, label) {
  log(`${target.name}/${label}: open export menu`);
  const trigger = page.locator("[data-dashboard-export-trigger]");
  await trigger.click();

  const pdfPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("menuitem", { name: /PDF siap cetak/ }).click();
  log(`${target.name}/${label}: pdf download started`);
  const pdfDownload = await pdfPromise;
  const pdfPath = join(outDir, `${target.name}-${label}.pdf`);
  await pdfDownload.saveAs(pdfPath);
  const pdfBytes = await readFile(pdfPath);
  const doc = await PDFDocument.load(pdfBytes);
  const first = doc.getPages()[0];
  const pdfInfo = {
    bytes: pdfBytes.length,
    pages: doc.getPageCount(),
    width: first.getWidth(),
    height: first.getHeight(),
  };

  log(`${target.name}/${label}: open export menu for png`);
  await trigger.click();
  const pngPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("menuitem", { name: /Gambar siap dibagikan/ }).click();
  log(`${target.name}/${label}: png download started`);
  const pngDownload = await pngPromise;
  const pngPath = join(outDir, `${target.name}-${label}.png`);
  await pngDownload.saveAs(pngPath);
  const pngBuffer = await readFile(pngPath);
  const pngInfo = pngSize(pngBuffer);

  log(
    `${target.name}/${label}: pdf ${pdfInfo.pages} hal ${pdfInfo.width.toFixed(2)}x${pdfInfo.height.toFixed(2)}pt ${pdfInfo.bytes}B; png ${pngInfo?.width}x${pngInfo?.height} ${pngBuffer.length}B`,
  );
  return {
    role: target.name,
    variant: label,
    pdf: pdfInfo,
    png: { bytes: pngBuffer.length, ...(pngInfo ?? {}) },
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = [];

  for (const target of TARGETS) {
    const context = await browser.newContext({
      storageState: join("e2e", ".auth", target.state),
      acceptDownloads: true,
    });
    const page = await context.newPage();
    try {
      log(`${target.name}: open ${target.path}`);
      await page.goto(`${baseURL}${target.path}`);
      await page.locator("[data-page-header]").waitFor({ timeout: 60_000 });

      report.push(await exportVariant(page, target, "all"));

      if (target.name === "master" || target.name === "regional") {
        log(`${target.name}/subset: open branch checklist`);
        const details = page.locator("#pilih-cabang details");
        if (!(await details.evaluate((node) => node.open))) {
          await page.locator("#pilih-cabang summary").click();
        }
        const branch = page
          .locator('#pilih-cabang input[type="checkbox"][id^="cabang-"]')
          .first();
        await branch.click();
        log(`${target.name}/subset: branch clicked, wait for url`);
        await page.waitForURL(/cabang=/, { timeout: 60_000 });
        const url = new URL(page.url());
        const selected = (url.searchParams.get("cabang") ?? "")
          .split(",")
          .filter(Boolean).length;
        await page
          .locator("#pilih-cabang")
          .getByText(/dari \d+.*cabang dipilih/)
          .waitFor({ timeout: 60_000 });
        log(
          `${target.name}/subset: ${selected} cabang, query ${url.search.length} char`,
        );

        report.push(await exportVariant(page, target, "subset"));
      }
    } catch (error) {
      log(
        `${target.name}: FAILED ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
