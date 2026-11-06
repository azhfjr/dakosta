#!/usr/bin/env node
/**
 * Production smoke test. Credentials are read from .secrets and never printed.
 * Every check reports PASS/FAIL with a non-zero exit code on failure.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

function arg(name, fallback) {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

function latestAccountsFile() {
  const directory = ".secrets";
  if (!existsSync(directory)) return null;
  const files = readdirSync(directory)
    .filter((file) => /^demo-accounts-.*\.txt$/.test(file))
    .sort();
  return files.length > 0 ? join(directory, files[files.length - 1]) : null;
}

function readAccounts(file) {
  const text = readFileSync(file, "utf8");
  const password = /^kata_sandi_bersama=(.+)$/m.exec(text)?.[1]?.trim();
  if (!password)
    throw new Error("Kata sandi demo tidak ditemukan di file .secrets.");
  const emails = {};
  for (const line of text.split(/\r?\n/)) {
    const match =
      /^(MASTER_ADMIN|REGIONAL_ADMIN|BRANCH_ADMIN|STAKEHOLDER)\s*\|\s*([^|]+)\s*\|/.exec(
        line,
      );
    if (!match) continue;
    const role = match[1];
    if (!emails[role]) emails[role] = match[2].trim();
  }
  for (const role of [
    "MASTER_ADMIN",
    "REGIONAL_ADMIN",
    "BRANCH_ADMIN",
    "STAKEHOLDER",
  ]) {
    if (!emails[role]) throw new Error(`Akun demo ${role} tidak ditemukan.`);
  }
  return { password, emails };
}

function jakartaMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function parseNumber(value) {
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  if (!response.ok) {
    throw new Error(
      `Login gagal (${response.status}). Periksa akun demo produksi.`,
    );
  }
  await response.arrayBuffer();
  const cookies = response.headers.getSetCookie?.() ?? [];
  const pairs = cookies
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair.includes("="));
  if (pairs.length === 0) throw new Error("Login tidak mengembalikan sesi.");
  return pairs.join("; ");
}

function createChecks() {
  const checks = [];
  const record = (name, passed, detail = "") => {
    checks.push({ name, passed: Boolean(passed), detail });
    console.log(
      `${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
    );
  };
  return { checks, record };
}

async function main() {
  const baseUrl = arg("base-url", "https://dakosta-dakosta.vercel.app").replace(
    /\/$/,
    "",
  );
  if (!/^https?:\/\//.test(baseUrl)) throw new Error("--base-url tidak valid.");
  const accountsFile = arg("accounts", latestAccountsFile());
  if (!accountsFile || !existsSync(accountsFile)) {
    throw new Error("File akun demo .secrets tidak ditemukan.");
  }
  const accounts = readAccounts(accountsFile);
  const month = jakartaMonth();
  const { checks, record } = createChecks();

  async function get(path, cookie, options = {}) {
    return fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: options.redirect ?? "manual",
    });
  }

  // Public checks
  const health = await get("/api/health");
  record("/api/health 200", health.status === 200, `status ${health.status}`);
  const landing = await get("/masuk");
  const headers = landing.headers;
  record(
    "header keamanan",
    headers.get("x-frame-options") === "DENY" &&
      Boolean(headers.get("content-security-policy")) &&
      Boolean(headers.get("x-content-type-options")),
    "X-Frame-Options/CSP/X-Content-Type-Options",
  );
  const anonymousAdmin = await get("/admin");
  record(
    "unauth /admin diarahkan ke /masuk",
    anonymousAdmin.status >= 300 &&
      anonymousAdmin.status < 400 &&
      (anonymousAdmin.headers.get("location") ?? "").includes("/masuk"),
    `status ${anonymousAdmin.status}`,
  );
  const anonymousApi = await get("/api/v1/admin/reviews");
  record(
    "unauth API 401",
    anonymousApi.status === 401,
    `status ${anonymousApi.status}`,
  );

  // Sessions
  const cookie = {
    admin: await login(
      baseUrl,
      accounts.emails.MASTER_ADMIN,
      accounts.password,
    ),
    regional: await login(
      baseUrl,
      accounts.emails.REGIONAL_ADMIN,
      accounts.password,
    ),
    branch: await login(
      baseUrl,
      accounts.emails.BRANCH_ADMIN,
      accounts.password,
    ),
    client: await login(
      baseUrl,
      accounts.emails.STAKEHOLDER,
      accounts.password,
    ),
  };
  record("login 4 peran", true, "sesi dibuat tanpa mencetak kredensial");

  const pageChecks = [
    ["admin", "/admin"],
    ["regional", "/wilayah"],
    ["regional", `/wilayah/dashboard?period=${month}`],
    ["regional", `/wilayah/kinerja?period=${month}`],
    ["branch", "/cabang"],
    ["branch", `/cabang/dashboard?period=${month}`],
    ["branch", `/cabang/kinerja?period=${month}`],
    ["client", "/client"],
  ];
  for (const [role, path] of pageChecks) {
    const response = await get(path, cookie[role]);
    record(
      `${role} ${path} 200`,
      response.status === 200,
      `status ${response.status}`,
    );
    await response.arrayBuffer();
  }

  // RBAC negatives
  const regionalReview = await fetch(`${baseUrl}/api/v1/admin/reviews`, {
    method: "POST",
    headers: {
      cookie: cookie.regional,
      "content-type": "application/json",
      origin: baseUrl,
      referer: `${baseUrl}/`,
    },
    body: JSON.stringify({
      submissionId: "00000000-0000-4000-8000-000000000000",
      expectedVersion: 1,
      action: "APPROVE",
      checklist: {
        relevansiTema: true,
        akurasiKonten: true,
        kelengkapanTautan: true,
        etikaDanPrivasi: true,
      },
    }),
  });
  record(
    "regional tidak boleh approve",
    regionalReview.status === 403,
    `status ${regionalReview.status}`,
  );
  await regionalReview.arrayBuffer();

  // The branches API only implements POST; an empty body would fail validation
  // (400) even for a master, so a 403 here proves the RBAC guard runs first.
  const branchAdminApi = await fetch(`${baseUrl}/api/v1/admin/branches`, {
    method: "POST",
    headers: {
      cookie: cookie.branch,
      "content-type": "application/json",
      origin: baseUrl,
      referer: `${baseUrl}/`,
    },
    body: JSON.stringify({}),
  });
  record(
    "cabang tidak boleh mengelola cabang",
    branchAdminApi.status === 403,
    `status ${branchAdminApi.status}`,
  );
  await branchAdminApi.arrayBuffer();

  // Exports
  const pdfResponse = await get(
    `/api/v1/reports/performance?period=${month}&pageSize=25`,
    cookie.regional,
  );
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
  record(
    "PDF Kinerja valid",
    pdfResponse.status === 200 &&
      pdfBuffer.subarray(0, 5).toString() === "%PDF-",
    `status ${pdfResponse.status}, ${pdfBuffer.length} byte`,
  );
  record(
    "PDF Kinerja diberi nama periode",
    (pdfResponse.headers.get("content-disposition") ?? "").includes(
      `laporan-kinerja-${month}.pdf`,
    ),
    "Content-Disposition",
  );

  const oldPdf = await get(
    `/api/v1/reports/achievement?month=${month}`,
    cookie.admin,
  );
  record(
    "PDF lama tidak tersedia",
    oldPdf.status === 404,
    `status ${oldPdf.status}`,
  );
  await oldPdf.arrayBuffer();

  // Reconciliation: master dashboard API = master CSV, and regional Kinerja
  // page = regional CSV. The dashboard API is master-scoped, so it must not be
  // compared against a regional export.
  const dashboard = await get(
    `/api/v1/dashboard/admin?period=${month}`,
    cookie.admin,
  );
  let dashboardApproved = null;
  if (dashboard.status === 200) {
    try {
      const payload = await dashboard.json();
      dashboardApproved = payload?.data?.approved?.value ?? null;
    } catch {
      dashboardApproved = null;
    }
  }
  const kinerjaHtml = await (
    await get(`/wilayah/kinerja?period=${month}`, cookie.regional)
  ).text();
  const kinerjaMatch = /Realisasi approved[\s\S]{0,1500}?>([\d.,]+)</.exec(
    kinerjaHtml,
  );
  const kinerjaApproved = kinerjaMatch ? parseNumber(kinerjaMatch[1]) : null;

  const csvResponse = await get(
    `/api/v1/exports/performance?period=${month}`,
    cookie.regional,
  );
  const csvText = (await csvResponse.text()).replace(/^\uFEFF/, "");
  const csvRows = parseCsv(csvText);
  const csvHeader = csvRows[0] ?? [];
  const approvedColumn = csvHeader.findIndex(
    (header) => header === "Realisasi Approved",
  );
  const csvApproved =
    approvedColumn >= 0
      ? csvRows
          .slice(1)
          .reduce(
            (sum, row) => sum + (parseNumber(row[approvedColumn]) ?? 0),
            0,
          )
      : null;
  record(
    "CSV Kinerja dapat diunduh",
    csvResponse.status === 200 && approvedColumn >= 0,
    `status ${csvResponse.status}, ${csvRows.length - 1} baris`,
  );

  const adminCsvResponse = await get(
    `/api/v1/exports/performance?period=${month}`,
    cookie.admin,
  );
  const adminCsvRows = parseCsv(
    (await adminCsvResponse.text()).replace(/^\uFEFF/, ""),
  );
  const adminApprovedColumn = (adminCsvRows[0] ?? []).findIndex(
    (header) => header === "Realisasi Approved",
  );
  const adminCsvApproved =
    adminApprovedColumn >= 0
      ? adminCsvRows
          .slice(1)
          .reduce(
            (sum, row) => sum + (parseNumber(row[adminApprovedColumn]) ?? 0),
            0,
          )
      : null;
  record(
    "rekonsiliasi Dashboard = Kinerja = CSV",
    dashboardApproved !== null &&
      adminCsvApproved !== null &&
      dashboardApproved === adminCsvApproved &&
      kinerjaApproved !== null &&
      csvApproved !== null &&
      kinerjaApproved === csvApproved,
    `dashboard ${dashboardApproved}, csv admin ${adminCsvApproved}, kinerja wilayah ${kinerjaApproved}, csv wilayah ${csvApproved}`,
  );

  const submissionsCsv = await get(
    `/api/v1/exports/submissions?period=${month}&status=APPROVED`,
    cookie.branch,
  );
  const submissionsText = await submissionsCsv.text();
  record(
    "CSV konten terunduh",
    submissionsCsv.status === 200 &&
      submissionsText.includes("Referensi") &&
      submissionsText.split(/\r?\n/).length >= 2,
    `status ${submissionsCsv.status}`,
  );

  const failures = checks.filter((check) => !check.passed);
  mkdirSync(join("docs", "audit", "evidence"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(
    "docs",
    "audit",
    "evidence",
    `E-smoke-production-${stamp}.json`,
  );
  writeFileSync(
    file,
    JSON.stringify(
      {
        baseUrl,
        period: month,
        generatedAt: new Date().toISOString(),
        passed: failures.length === 0,
        checks,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Evidence: ${file}`);
  if (failures.length > 0) {
    console.error(`GAGAL: ${failures.length} pemeriksaan tidak lulus.`);
    process.exit(1);
  }
  console.log(`LULUS: ${checks.length} pemeriksaan produksi.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
