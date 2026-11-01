import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { request } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.E2E_PORT ?? "3300"}`;
const authDir = path.join("e2e", ".auth");

const PUBLIC_PAGES = [
  "/",
  "/masuk",
  "/tentang",
  "/bantuan",
  "/akses-ditolak",
  "/halaman-tidak-ada",
  "/api/health",
];

const ROLE_PAGES = {
  admin: [
    "/admin",
    "/admin/akun",
    "/admin/analitik",
    "/admin/audit",
    "/admin/cabang",
    "/admin/edufast",
    "/admin/impor",
    "/admin/konten",
    "/admin/konten/impor",
    "/admin/notifikasi",
    "/admin/organisasi",
    "/admin/pengguna",
    "/admin/peta",
    "/admin/red-notice",
    "/admin/stakeholder",
    "/admin/target",
    "/admin/validasi",
    "/admin/wilayah",
  ],
  regional: [
    "/wilayah",
    "/wilayah/analitik",
    "/wilayah/cabang",
    "/wilayah/konten",
    "/wilayah/laporan",
    "/wilayah/notifikasi",
    "/wilayah/organisasi",
    "/wilayah/peta",
    "/wilayah/red-notice",
  ],
  branch: [
    "/cabang",
    "/cabang/analitik",
    "/cabang/konten",
    "/cabang/laporan",
    "/cabang/notifikasi",
    "/cabang/organisasi",
    "/cabang/peta",
    "/cabang/red-notice",
    "/cabang/review",
  ],
  client: [
    "/client",
    "/client/analitik",
    "/client/konten",
    "/client/lapor",
    "/client/notifikasi",
    "/client/profil",
  ],
};

const ROLE_APIS = {
  admin: [
    "/api/v1/me",
    "/api/v1/admin/targets",
    "/api/v1/admin/reviews",
    "/api/v1/admin/users",
    "/api/v1/admin/edufast/policies",
    "/api/v1/dashboard/admin",
    "/api/v1/analytics/series",
    "/api/v1/map",
    "/api/v1/notifications",
    "/api/v1/notifications/unread-count",
    "/api/v1/submissions",
  ],
  regional: [
    "/api/v1/me",
    "/api/v1/dashboard/admin",
    "/api/v1/map",
    "/api/v1/notifications",
  ],
  branch: ["/api/v1/me", "/api/v1/admin/reviews", "/api/v1/dashboard/admin"],
  client: [
    "/api/v1/me",
    "/api/v1/dashboard/client",
    "/api/v1/submissions",
    "/api/v1/notifications",
  ],
};

const failures = [];
const warnings = [];

function stateFor(role) {
  const file = {
    admin: "admin.json",
    regional: "regional.json",
    branch: "branch-a1.json",
    client: "client.json",
  }[role];
  const resolved = file ? path.join(authDir, file) : null;
  return resolved && existsSync(resolved) ? resolved : null;
}

async function check(context, label, url, role) {
  let response;
  try {
    response = await context.get(url, { maxRedirects: 0, timeout: 60_000 });
  } catch (error) {
    failures.push({ role, url, reason: `request gagal: ${error.message}` });
    return;
  }

  const status = response.status();
  const location = response.headers()["location"] ?? "";
  if (status >= 500) {
    let body = "";
    try {
      body = (await response.text()).slice(0, 300);
    } catch {
      // body opsional
    }
    failures.push({ role, url, reason: `HTTP ${status} ${body}` });
    return;
  }
  if (status >= 400 && status !== 401 && status !== 403) {
    warnings.push({ role, url, reason: `HTTP ${status}` });
  }
  if (status === 401 || status === 403) {
    warnings.push({ role, url, reason: `HTTP ${status} (izin ditolak)` });
  }
  console.log(
    `${status} ${role.padEnd(8)} ${url}${location ? ` -> ${location}` : ""}`,
  );
}

async function main() {
  const anonymous = await request.newContext({ baseURL });
  try {
    for (const page of PUBLIC_PAGES) {
      await check(anonymous, "public", page, "public");
    }
  } finally {
    await anonymous.dispose();
  }

  for (const [role, pages] of Object.entries(ROLE_PAGES)) {
    const file = stateFor(role);
    if (!file) {
      warnings.push({
        role,
        url: "-",
        reason: "state login tidak ditemukan, dilewati",
      });
      continue;
    }
    const storageState = JSON.parse(readFileSync(file, "utf8"));
    const context = await request.newContext({ baseURL, storageState });
    try {
      for (const page of pages) await check(context, page, page, role);
      for (const api of ROLE_APIS[role] ?? [])
        await check(context, api, api, role);
    } finally {
      await context.dispose();
    }
  }

  if (warnings.length > 0) {
    console.log("\nPeringatan:");
    for (const item of warnings) {
      console.log(`  ${item.role.padEnd(8)} ${item.url} — ${item.reason}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nGagal:");
    for (const item of failures) {
      console.error(`  ${item.role.padEnd(8)} ${item.url} — ${item.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("\nSemua rute merespons tanpa error 5xx.");
}

await main();
