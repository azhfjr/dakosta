// Inventory generator untuk audit v2 (read-only, tidak menyentuh aplikasi).
// Menghasilkan 03-feature-coverage-matrix.csv dari src/app.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");
const OUT = join(
  ROOT,
  "docs",
  "audit",
  "v2-audit-2026-11",
  "03-feature-coverage-matrix.csv",
);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function routeOf(file) {
  const rel = relative(APP, file).split(sep).join("/");
  return (
    rel.replace(/(^|\/)(page|route)\.tsx?$/, "").replace(/^\/?/, "/") || "/"
  );
}

const files = walk(APP);

const REDIRECTS = {
  "/wilayah/peta": "/wilayah/dashboard?view=peta",
  "/wilayah/analitik": "/wilayah/dashboard",
  "/wilayah/laporan": "/wilayah/kinerja",
  "/wilayah/konten": "/wilayah/dashboard?view=konten",
  "/cabang/analitik": "/cabang/dashboard",
  "/cabang/peta": "/cabang/dashboard?view=peta",
  "/cabang/laporan": "/cabang/kinerja",
  "/cabang/konten": "/cabang/dashboard?view=konten",
  "/cabang/review": "/cabang?…",
  "/admin/laporan": "/admin/analitik",
  "/admin/pengguna": "/admin/akun",
  "/admin/stakeholder": "/admin/organisasi",
};

const PAGE_LABELS = {
  "/": "Landing",
  "/masuk": "Masuk",
  "/tentang": "Tentang",
  "/bantuan": "Bantuan",
  "/akses-ditolak": "Akses ditolak",
  "/aktivasi-lokasi": "Aktivasi lokasi (grace period)",
  "/ganti-password": "Ganti password wajib",
  "/admin": "Ringkasan",
  "/admin/validasi": "Validasi",
  "/admin/validasi/[id]": "Detail validasi",
  "/admin/konten": "Konten",
  "/admin/wilayah": "Wilayah",
  "/admin/cabang": "Cabang",
  "/admin/organisasi": "Organisasi",
  "/admin/edufast": "EDUFAST",
  "/admin/red-notice": "Red Notice",
  "/admin/impor": "Impor akun",
  "/admin/konten/impor": "Impor konten",
  "/admin/akun": "Akun",
  "/admin/peta": "Peta",
  "/admin/analitik": "Analitik",
  "/admin/target": "Target",
  "/admin/notifikasi": "Notifikasi",
  "/admin/audit": "Audit",
  "/wilayah": "SLA Check (regional)",
  "/wilayah/dashboard": "Dashboard regional",
  "/wilayah/kinerja": "Kinerja regional",
  "/wilayah/cabang": "Cabang dalam wilayah",
  "/wilayah/organisasi": "Organisasi wilayah",
  "/wilayah/red-notice": "Red Notice regional",
  "/wilayah/notifikasi": "Notifikasi regional",
  "/wilayah/konten/[id]": "Detail konten (regional)",
  "/cabang": "SLA Check (cabang)",
  "/cabang/dashboard": "Dashboard cabang",
  "/cabang/kinerja": "Kinerja cabang",
  "/cabang/organisasi": "Organisasi cabang",
  "/cabang/red-notice": "Red Notice cabang",
  "/cabang/notifikasi": "Notifikasi cabang",
  "/cabang/review/[id]": "Detail review",
  "/cabang/konten/[id]": "Detail konten (cabang)",
  "/client": "Beranda stakeholder",
  "/client/lapor": "Lapor konten",
  "/client/konten": "Konten saya",
  "/client/konten/[id]": "Detail konten saya",
  "/client/analitik": "Analitik stakeholder",
  "/client/notifikasi": "Notifikasi stakeholder",
  "/client/profil": "Profil",
};

const API_PURPOSE = {
  "/api/health": "Health check DB",
  "/api/auth/[...all]": "Better Auth handler",
  "/api/v1/me": "Profil sesi + capabilities",
  "/api/v1/me/password": "Ganti password",
  "/api/v1/me/step-up": "Step-up re-auth",
  "/api/v1/demo/login": "Login cepat demo per peran",
  "/api/v1/submissions": "Daftar & simpan submission",
  "/api/v1/submissions/[id]": "Detail submission",
  "/api/v1/notifications": "Daftar & baca notifikasi",
  "/api/v1/notifications/unread-count": "Jumlah belum dibaca",
  "/api/v1/realtime/notifications": "SSE notifikasi",
  "/api/v1/map": "Titik peta ter-scope",
  "/api/v1/analytics/series": "Seri analitik",
  "/api/v1/dashboard/admin": "Ringkasan dashboard master",
  "/api/v1/dashboard/client": "Ringkasan dashboard stakeholder",
  "/api/v1/reports/performance": "PDF laporan kinerja",
  "/api/v1/exports/performance": "CSV kinerja",
  "/api/v1/exports/submissions": "CSV konten (stream)",
  "/api/v1/activation/location": "Simpan lokasi saat aktivasi",
  "/api/v1/admin/outbox/drain": "Drain outbox notifikasi",
  "/api/v1/admin/users": "Daftar & buat akun",
  "/api/v1/admin/users/[id]": "Ubah akun & reset password",
  "/api/v1/admin/organizations": "Buat organisasi",
  "/api/v1/admin/organizations/[id]": "Ubah organisasi",
  "/api/v1/admin/branches": "Buat cabang",
  "/api/v1/admin/branches/[id]": "Ubah cabang",
  "/api/v1/admin/regions": "Buat wilayah",
  "/api/v1/admin/regions/[id]": "Ubah wilayah",
  "/api/v1/admin/reviews": "Daftar & simpan review",
  "/api/v1/admin/reviews/start": "Mulai review",
  "/api/v1/admin/contents/[id]/revoke": "Revoke konten",
  "/api/v1/admin/edufast/policies": "Daftar & buat policy",
  "/api/v1/admin/edufast/policies/publish": "Publish policy",
  "/api/v1/admin/edufast/policies/archive": "Arsip policy",
  "/api/v1/admin/edufast/policies/copy": "Salin policy",
  "/api/v1/admin/targets": "Daftar & buat target",
  "/api/v1/admin/targets/[id]": "Ubah & hapus target",
  "/api/v1/admin/targets/sync": "Sinkron target",
  "/api/v1/admin/targets/stakeholders": "Daftar stakeholder target",
  "/api/v1/admin/imports": "Daftar import",
  "/api/v1/admin/imports/template": "Template CSV akun",
  "/api/v1/admin/imports/preview": "Preview import akun",
  "/api/v1/admin/imports/commit": "Commit import akun",
  "/api/v1/admin/imports/content/template": "Template CSV konten",
  "/api/v1/admin/imports/content/preview": "Preview import konten",
  "/api/v1/admin/imports/content/commit": "Commit import konten",
};

function pageRoles(route) {
  if (route === "/") return "PUBLIC";
  if (["/masuk", "/tentang", "/bantuan", "/akses-ditolak"].includes(route))
    return "PUBLIC";
  if (route === "/ganti-password") return "AUTHENTICATED";
  if (route === "/aktivasi-lokasi") return "REGIONAL_ADMIN|BRANCH_ADMIN";
  if (route.startsWith("/admin")) return "MASTER_ADMIN";
  if (route.startsWith("/wilayah")) return "REGIONAL_ADMIN";
  if (route.startsWith("/cabang")) return "BRANCH_ADMIN";
  if (route.startsWith("/client")) return "STAKEHOLDER";
  return "UNKNOWN";
}

function pageRisk(route) {
  if (REDIRECTS[route]) return "Rendah";
  if (
    route === "/" ||
    [
      "/masuk",
      "/tentang",
      "/bantuan",
      "/akses-ditolak",
      "/ganti-password",
      "/aktivasi-lokasi",
    ].includes(route)
  )
    return route === "/masuk" || route === "/ganti-password"
      ? "Sedang"
      : "Rendah";
  if (route.includes("[id]")) return "Sedang";
  return "Sedang";
}

function apiRoles(text, route) {
  if (route === "/api/health") return "PUBLIC";
  if (route.startsWith("/api/auth/")) return "PUBLIC";
  if (route === "/api/v1/demo/login") return "PUBLIC (demo mode)";
  if (/requireMasterApi\(/.test(text)) return "MASTER_ADMIN";
  if (/requireApiRole\("MASTER_ADMIN",\s*"BRANCH_ADMIN"\)/.test(text))
    return "MASTER_ADMIN|BRANCH_ADMIN";
  if (/getApiUserWithRole\("ADMIN"\)/.test(text)) return "MASTER_ADMIN";
  if (/getApiUserWithRole\("CLIENT"\)/.test(text)) return "STAKEHOLDER";
  if (/getApiUser\(|getApiAuth\(/.test(text)) return "AUTHENTICATED";
  return "UNKNOWN";
}

function apiRisk(route, methods) {
  if (route === "/api/health") return "Rendah";
  if (route.startsWith("/api/auth/")) return "Tinggi";
  if (route === "/api/v1/demo/login") return "Sedang";
  if (/POST|PATCH|DELETE|PUT/.test(methods)) {
    if (route.includes("/admin/")) return "Tinggi";
    return "Sedang";
  }
  if (route.includes("exports") || route.includes("reports")) return "Sedang";
  if (route.includes("realtime")) return "Sedang";
  return "Sedang";
}

const SERVICE_DEMO_GUARD = new Set([
  "/api/v1/admin/users/[id]",
  "/api/v1/admin/branches",
  "/api/v1/admin/branches/[id]",
  "/api/v1/admin/regions",
  "/api/v1/admin/regions/[id]",
  "/api/v1/admin/organizations",
  "/api/v1/admin/organizations/[id]",
]);

function methodsOf(text) {
  const found = [];
  for (const m of text.matchAll(
    /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\b/g,
  )) {
    found.push(m[1]);
  }
  return found;
}

const rows = [];
let pageId = 0;
let apiId = 0;
const pad = (n) => String(n).padStart(3, "0");

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (rel.endsWith("/page.tsx")) {
    const route = routeOf(file);
    const redirectTo = REDIRECTS[route] ?? "";
    rows.push({
      ID: `PG-${pad(++pageId)}`,
      Tipe: "page",
      Rute: route,
      Metode: "GET",
      Peran: pageRoles(route),
      Alur: redirectTo
        ? `redirect → ${redirectTo}`
        : (PAGE_LABELS[route] ?? "—"),
      Dependency: "Server Component / layout auth",
      Scope: route.startsWith("/admin")
        ? "GLOBAL"
        : route.startsWith("/wilayah")
          ? "REGION"
          : route.startsWith("/cabang")
            ? "BRANCH"
            : route.startsWith("/client")
              ? "ORG"
              : "—",
      Risiko: pageRisk(route),
      Sumber: rel,
      "Status eksistensi": "INFERRED",
      "Status uji": "NOT TESTED",
      Catatan: redirectTo ? `Redirect-only; target ${redirectTo}` : "",
    });
  }
}

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (!rel.endsWith("/route.ts")) continue;
  const text = readFileSync(file, "utf8");
  const route = routeOf(file);
  const methods = methodsOf(text);
  const handlerList = methods.length ? methods : ["UNKNOWN"];
  const sameOrigin = /assertSameOrigin\(/.test(text) ? "ya" : "tidak";
  const rateLimit = /consumeRateLimit\(/.test(text) ? "ya" : "tidak";
  const demoGuard = SERVICE_DEMO_GUARD.has(route)
    ? "ya (service)"
    : /assertDemoCannot\w*\(|isDemo/.test(text)
      ? "ya"
      : "tidak";
  for (const method of handlerList) {
    rows.push({
      ID: `API-${pad(++apiId)}`,
      Tipe: "api",
      Rute: route,
      Metode: method,
      Peran: apiRoles(text, route),
      Alur: API_PURPOSE[route] ?? "—",
      Dependency: "Route Handler → authz → Drizzle/Neon",
      Scope: /requireMasterApi/.test(text)
        ? "GLOBAL"
        : /getApiUser\(|getApiAuth\(/.test(text)
          ? "SCOPE-DEPENDENT"
          : "—",
      Risiko: apiRisk(route, method),
      Sumber: rel,
      "Status eksistensi": "INFERRED",
      "Status uji": "NOT TESTED",
      Catatan: `same-origin=${sameOrigin}; rate-limit=${rateLimit}; demo-guard=${demoGuard}`,
    });
  }
}

const header = [
  "ID",
  "Tipe",
  "Rute",
  "Metode",
  "Peran",
  "Alur",
  "Dependency",
  "Scope",
  "Risiko",
  "Sumber",
  "Status eksistensi",
  "Status uji",
  "Catatan",
];

const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = [header.map(quote).join(",")]
  .concat(rows.map((r) => header.map((h) => quote(r[h])).join(",")))
  .join("\r\n");

writeFileSync(OUT, csv + "\r\n", "utf8");

const pages = rows.filter((r) => r.Tipe === "page");
const apis = rows.filter((r) => r.Tipe === "api");
const mutations = apis.filter((r) => /POST|PATCH|DELETE|PUT/.test(r.Metode));
const list = (arr) => arr.map((r) => `${r.Metode} ${r.Rute}`);
console.log(
  JSON.stringify(
    {
      output: relative(ROOT, OUT),
      pages: pages.length,
      redirectPages: pages.filter((r) => r.Alur.startsWith("redirect")).length,
      apiRouteFiles: new Set(apis.map((r) => r.Rute)).size,
      apiHandlers: apis.length,
      publicHandlers: apis.filter((r) => r.Peran.startsWith("PUBLIC")).length,
      masterHandlers: apis.filter((r) => r.Peran === "MASTER_ADMIN").length,
      reviewHandlers: apis.filter(
        (r) => r.Peran === "MASTER_ADMIN|BRANCH_ADMIN",
      ).length,
      scopeDependentHandlers: apis.filter((r) => r.Scope === "SCOPE-DEPENDENT")
        .length,
      mutationHandlers: mutations.length,
      mutationsWithoutSameOrigin: list(
        mutations.filter((r) => r.Catatan.includes("same-origin=tidak")),
      ),
      mutationsWithoutRateLimit: list(
        mutations.filter((r) => r.Catatan.includes("rate-limit=tidak")),
      ),
      masterMutationsWithoutDemoGuard: list(
        mutations.filter(
          (r) =>
            r.Peran === "MASTER_ADMIN" &&
            r.Catatan.includes("demo-guard=tidak"),
        ),
      ),
    },
    null,
    2,
  ),
);
