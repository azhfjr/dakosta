// Harness audit aksesibilitas WCAG 2.2 AA terhadap produksi DAKOSTA.
// Hanya GET halaman dan interaksi klien yang tidak mengirim mutasi
// (membuka dialog, Escape, Tab). Login memakai akun demo dari .secrets;
// nilai kredensial tidak pernah dicetak ke output.
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  request,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (
  process.env.A11Y_BASE_URL ?? "https://dakosta-dakosta.vercel.app"
).replace(/\/+$/, "");
const RUN_TS =
  process.env.A11Y_RUN_TS ?? new Date().toISOString().replace(/[:.]/g, "-");
const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs",
  "audit",
  "v2-audit-2026-11",
  "evidence",
);
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, `E-a11y-${RUN_TS}.json`);
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type RoleKey = "master" | "regional" | "branch" | "client";

const ROLE_KEYS: Record<RoleKey, string> = {
  master: "MASTER_ADMIN",
  regional: "REGIONAL_ADMIN",
  branch: "BRANCH_ADMIN",
  client: "STAKEHOLDER",
};

const PAGES: Record<RoleKey, string[]> = {
  master: [
    "/admin",
    "/admin/analitik",
    "/admin/audit",
    "/admin/akun",
    "/admin/cabang",
    "/admin/edufast",
    "/admin/impor",
    "/admin/konten",
    "/admin/konten/impor",
    "/admin/notifikasi",
    "/admin/organisasi",
    "/admin/peta",
    "/admin/red-notice",
    "/admin/target",
    "/admin/validasi",
    "/admin/wilayah",
  ],
  regional: [
    "/wilayah",
    "/wilayah/dashboard",
    "/wilayah/kinerja",
    "/wilayah/red-notice",
    "/wilayah/cabang",
    "/wilayah/organisasi",
    "/wilayah/notifikasi",
  ],
  branch: [
    "/cabang",
    "/cabang/dashboard",
    "/cabang/kinerja",
    "/cabang/red-notice",
    "/cabang/organisasi",
    "/cabang/notifikasi",
  ],
  client: [
    "/client",
    "/client/analitik",
    "/client/konten",
    "/client/lapor",
    "/client/profil",
    "/client/notifikasi",
  ],
};

const PUBLIC_PAGES = ["/", "/masuk", "/tentang", "/bantuan", "/akses-ditolak"];

type A11yRecord = {
  kind: "axe" | "keyboard" | "dialog" | "reflow";
  role: string;
  route: string;
  status?: number;
  finalPath?: string;
  outcome?: string;
  seriousCritical?: number;
  violations?: Array<{
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: number;
    samples: Array<{ target: string; summary: string }>;
  }>;
  detail?: unknown;
  timestamp: string;
};

const records: A11yRecord[] = [];

function latestAccountsFile(): string {
  const dir = path.join(process.cwd(), ".secrets");
  if (!existsSync(dir)) throw new Error(".secrets tidak ditemukan.");
  const files = readdirSync(dir)
    .filter((f) => /^demo-accounts-.*\.txt$/.test(f))
    .sort();
  if (!files.length) throw new Error("Berkas akun demo tidak ditemukan.");
  return path.join(dir, files[files.length - 1]);
}

function readAccounts(): {
  password: string;
  emails: Record<string, string>;
} {
  const text = readFileSync(latestAccountsFile(), "utf8");
  const password = /^kata_sandi_bersama=(.+)$/m.exec(text)?.[1]?.trim();
  if (!password) throw new Error("Kata sandi bersama tidak ditemukan.");
  const emails: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match =
      /^(MASTER_ADMIN|REGIONAL_ADMIN|BRANCH_ADMIN|STAKEHOLDER)\s*\|\s*([^|]+)\s*\|/.exec(
        line,
      );
    if (match && !emails[match[1]]) emails[match[1]] = match[2].trim();
  }
  return { password, emails };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn(
  browser: Browser,
  role: RoleKey,
  accounts: ReturnType<typeof readAccounts>,
) {
  const email = accounts.emails[ROLE_KEYS[role]];
  if (!email) throw new Error(`Email demo ${role} tidak tersedia.`);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const api = await request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { origin: BASE },
    });
    const res = await api.post("/api/auth/sign-in/email", {
      data: { email, password: accounts.password },
      failOnStatusCode: false,
    });
    if (res.status() === 429 && attempt === 1) {
      await res.dispose();
      await api.dispose();
      await sleep(65_000);
      continue;
    }
    if (!res.ok()) {
      await res.dispose();
      await api.dispose();
      throw new Error(`Login ${role} gagal (HTTP ${res.status()}).`);
    }
    await res.dispose();
    const state = await api.storageState();
    await api.dispose();
    return browser.newContext({
      storageState: state,
      viewport: { width: 1440, height: 900 },
    });
  }
  throw new Error(`Login ${role} gagal setelah retry.`);
}

async function settle(page: Page) {
  await page
    .locator("main, h1")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function auditPage(page: Page, role: string, route: string) {
  let status = 0;
  let navigationError: string | null = null;
  try {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    status = response?.status() ?? 0;
  } catch (error) {
    navigationError = String(error).slice(0, 300);
  }
  await settle(page);

  const finalPath = page.url().startsWith(BASE)
    ? new URL(page.url()).pathname
    : page.url();

  const isAuthRedirect = finalPath === "/masuk" && route !== "/masuk";
  const isAccessDenied =
    finalPath === "/akses-ditolak" && route !== "/akses-ditolak";

  if (navigationError || isAuthRedirect || isAccessDenied) {
    records.push({
      kind: "axe",
      role,
      route,
      status,
      finalPath,
      outcome: isAuthRedirect
        ? "AUTH_REDIRECT"
        : isAccessDenied
          ? "ACCESS_DENIED"
          : "NAVIGATION_ERROR",
      detail: navigationError,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  let violations: A11yRecord["violations"] = [];
  try {
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    violations = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags.filter((tag) => tag.startsWith("wcag")),
      nodes: violation.nodes.length,
      samples: violation.nodes.slice(0, 3).map((node) => ({
        target: node.target.join(" "),
        summary: (node.failureSummary ?? "").slice(0, 240),
      })),
    }));
  } catch (error) {
    records.push({
      kind: "axe",
      role,
      route,
      status,
      finalPath,
      outcome: "AXE_ERROR",
      detail: String(error).slice(0, 300),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const seriousCritical = violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  ).length;

  records.push({
    kind: "axe",
    role,
    route,
    status,
    finalPath,
    outcome: finalPath === route ? "OK" : "REDIRECTED",
    seriousCritical,
    violations,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[axe] ${role} ${route} -> ${finalPath} status=${status} violations=${violations.length} seriousCritical=${seriousCritical}` +
      (violations.length
        ? ` ids=${violations.map((violation) => violation.id).join(",")}`
        : ""),
  );
}

async function firstInternalLink(
  page: Page,
  prefix: string,
): Promise<string | null> {
  return page.evaluate((needle) => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    const found = anchors.find((anchor) =>
      (anchor.getAttribute("href") ?? "").startsWith(needle),
    );
    return found?.getAttribute("href") ?? null;
  }, prefix);
}

async function auditRoleSweep(
  browser: Browser,
  role: RoleKey,
  accounts: ReturnType<typeof readAccounts>,
  dynamic: Array<{
    from: string;
    prefix: string;
    discoverFrom?: string[];
  }> = [],
) {
  const context = await signIn(browser, role, accounts);
  const page = await context.newPage();
  try {
    for (const route of PAGES[role]) {
      await auditPage(page, role, route);
      await page.waitForTimeout(300);
    }
    for (const item of dynamic) {
      let href: string | null = null;
      for (const source of item.discoverFrom ?? [item.from]) {
        await page.goto(source, { waitUntil: "domcontentloaded" });
        await settle(page);
        href = await firstInternalLink(page, item.prefix);
        if (href) break;
      }
      if (href) {
        await auditPage(page, role, href);
      } else {
        records.push({
          kind: "axe",
          role,
          route: `${item.prefix}*`,
          outcome: "NOT_REACHABLE",
          detail: "Tidak ada tautan detail pada halaman daftar.",
          timestamp: new Date().toISOString(),
        });
      }
      await page.waitForTimeout(300);
    }
  } finally {
    await context.close();
  }
}

test.describe.configure({ mode: "serial" });

test("aksesibilitas halaman publik", async ({ page }) => {
  for (const route of PUBLIC_PAGES) {
    await auditPage(page, "public", route);
    await page.waitForTimeout(300);
  }
});

let accounts: ReturnType<typeof readAccounts>;

test.beforeAll(() => {
  accounts = readAccounts();
});

test("aksesibilitas Master Admin", async ({ browser }) => {
  await auditRoleSweep(browser, "master", accounts, [
    { from: "/admin/validasi", prefix: "/admin/validasi/" },
  ]);
});

test("aksesibilitas Regional Admin", async ({ browser }) => {
  await auditRoleSweep(browser, "regional", accounts, [
    {
      from: "/wilayah/dashboard",
      prefix: "/wilayah/konten/",
      discoverFrom: ["/wilayah/dashboard", "/wilayah/kinerja"],
    },
  ]);
});

test("aksesibilitas Branch Admin", async ({ browser }) => {
  await auditRoleSweep(browser, "branch", accounts, [
    {
      from: "/cabang",
      prefix: "/cabang/review/",
      discoverFrom: ["/cabang", "/cabang/dashboard", "/cabang/kinerja"],
    },
    {
      from: "/cabang/dashboard",
      prefix: "/cabang/konten/",
      discoverFrom: ["/cabang/dashboard", "/cabang/kinerja"],
    },
  ]);
});

test("aksesibilitas Stakeholder", async ({ browser }) => {
  await auditRoleSweep(browser, "client", accounts, [
    { from: "/client/konten", prefix: "/client/konten/" },
  ]);
});

test("halaman ganti password sukarela", async ({ browser }) => {
  const context = await signIn(browser, "client", accounts);
  const page = await context.newPage();
  try {
    await auditPage(page, "client", "/ganti-password");
  } finally {
    await context.close();
  }
});

test("keyboard dan indikator fokus", async ({ browser }) => {
  const context = await signIn(browser, "master", accounts);
  const page = await context.newPage();
  try {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.keyboard.press("Tab");
    const firstFocus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        text: (element.textContent ?? "").trim().slice(0, 80),
        href: element.getAttribute("href"),
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
        boxShadow: style.boxShadow !== "none",
        visible: element.getBoundingClientRect().width > 0,
      };
    });
    records.push({
      kind: "keyboard",
      role: "master",
      route: "/admin",
      outcome: "TAB_FIRST",
      detail: firstFocus,
      timestamp: new Date().toISOString(),
    });

    await page.goto("/masuk", { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.keyboard.press("Tab");
    const loginFocus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        type: element.getAttribute("type"),
        name: element.getAttribute("name"),
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
        boxShadow: style.boxShadow !== "none",
      };
    });
    records.push({
      kind: "keyboard",
      role: "public",
      route: "/masuk",
      outcome: "TAB_FIRST",
      detail: loginFocus,
      timestamp: new Date().toISOString(),
    });
  } finally {
    await context.close();
  }
});

test("dialog target dapat diakses dan mengembalikan fokus", async ({
  browser,
}) => {
  const context = await signIn(browser, "master", accounts);
  const page = await context.newPage();
  try {
    await page.goto("/admin/target", { waitUntil: "domcontentloaded" });
    await settle(page);
    const trigger = page
      .getByRole("button", { name: /tambah target/i })
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();

    const focusInside = await page.evaluate(() => {
      const element = document.querySelector('[role="dialog"]');
      return element ? element.contains(document.activeElement) : false;
    });

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(WCAG_TAGS)
      .analyze();
    const violations = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      nodes: violation.nodes.length,
    }));

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const focusReturned = await page.evaluate(() =>
      /tambah target/i.test(document.activeElement?.textContent ?? ""),
    );

    records.push({
      kind: "dialog",
      role: "master",
      route: "/admin/target",
      outcome: violations.length ? "VIOLATIONS" : "PASS",
      detail: { focusInside, focusReturned, violations },
      timestamp: new Date().toISOString(),
    });
    console.log(
      `[dialog] /admin/target focusInside=${focusInside} focusReturned=${focusReturned} violations=${violations.length}`,
    );
  } finally {
    await context.close();
  }
});

test("reflow 200% dan 400% serta viewport 320/360/768/1440", async ({
  browser,
}) => {
  const viewports = [
    { width: 320, height: 800, label: "320" },
    { width: 360, height: 800, label: "360" },
    { width: 768, height: 1024, label: "768" },
    { width: 1440, height: 900, label: "1440" },
    { width: 640, height: 360, label: "zoom200" },
    { width: 320, height: 180, label: "zoom400" },
  ];
  const targets: Array<{ role: RoleKey | "public"; routes: string[] }> = [
    { role: "public", routes: ["/", "/masuk"] },
    {
      role: "master",
      routes: ["/admin", "/admin/analitik", "/admin/target", "/admin/impor"],
    },
    { role: "regional", routes: ["/wilayah/dashboard", "/wilayah/kinerja"] },
    { role: "branch", routes: ["/cabang", "/cabang/dashboard"] },
    { role: "client", routes: ["/client", "/client/lapor", "/client/konten"] },
  ];

  for (const target of targets) {
    let context;
    if (target.role === "public") {
      context = await browser.newContext();
    } else {
      context = await signIn(browser, target.role, accounts);
    }
    try {
      for (const viewport of viewports) {
        const page = await context.newPage();
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        try {
          for (const route of target.routes) {
            await page.goto(route, { waitUntil: "domcontentloaded" });
            await settle(page);
            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            }));
            const overflow = metrics.scrollWidth - metrics.innerWidth;
            records.push({
              kind: "reflow",
              role: target.role,
              route,
              outcome: overflow <= 1 ? "PASS" : "OVERFLOW",
              detail: {
                viewport: viewport.label,
                width: viewport.width,
                height: viewport.height,
                overflow,
              },
              timestamp: new Date().toISOString(),
            });
            if (overflow > 1) {
              console.log(
                `[reflow] ${target.role} ${route} @${viewport.label} overflow=${overflow}px`,
              );
            }
            await page.waitForTimeout(200);
          }
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }
});

test.afterAll(() => {
  const summary = {
    total: records.length,
    axePages: records.filter((record) => record.kind === "axe").length,
    axePagesWithViolations: records.filter(
      (record) => (record.violations?.length ?? 0) > 0,
    ).length,
    axePagesWithSeriousCritical: records.filter(
      (record) => (record.seriousCritical ?? 0) > 0,
    ).length,
    reflowFailures: records.filter(
      (record) => record.kind === "reflow" && record.outcome === "OVERFLOW",
    ).length,
    outcomes: records.reduce<Record<string, number>>((acc, record) => {
      const key = `${record.kind}:${record.outcome ?? "UNKNOWN"}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
  writeFileSync(
    EVIDENCE_FILE,
    `${JSON.stringify(
      {
        base: BASE,
        runTimestamp: RUN_TS,
        tags: WCAG_TAGS,
        browser: "chromium",
        engineVersion: "playwright-1.64.1/axe-core-4.14.0",
        summary,
        records,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`[a11y] evidence: ${EVIDENCE_FILE}`);
  console.log(`[a11y] summary: ${JSON.stringify(summary)}`);
});
