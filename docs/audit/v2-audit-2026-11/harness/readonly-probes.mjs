// Probe keamanan read-only terhadap produksi DAKOSTA.
// Aturan: hanya GET/HEAD, atau POST/PATCH dengan payload invalid/tidak ada ID nyata.
// Tidak pernah memanggil outbox drain, target sync, revoke/publish dengan ID nyata.
// Kredensial dibaca dari .secrets dan tidak pernah dicetak.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "https://dakosta-dakosta.vercel.app"
).replace(/\/+$/, "");
const DELAY_MS = 350;
const NIL_UUID = "00000000-0000-4000-8000-000000000000";

function latestAccountsFile() {
  if (!existsSync(".secrets")) return null;
  const files = readdirSync(".secrets")
    .filter((f) => /^demo-accounts-.*\.txt$/.test(f))
    .sort();
  return files.length ? join(".secrets", files[files.length - 1]) : null;
}

function readAccounts(file) {
  const text = readFileSync(file, "utf8");
  const password = /^kata_sandi_bersama=(.+)$/m.exec(text)?.[1]?.trim();
  if (!password) throw new Error("Shared password tidak ditemukan.");
  const emails = {};
  for (const line of text.split(/\r?\n/)) {
    const m =
      /^(MASTER_ADMIN|REGIONAL_ADMIN|BRANCH_ADMIN|STAKEHOLDER)\s*\|\s*([^|]+)\s*\|/.exec(
        line,
      );
    if (m && !emails[m[1]]) emails[m[1]] = m[2].trim();
  }
  return { password, emails };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cookieAttributes(res) {
  const items = res.headers.getSetCookie?.() ?? [];
  return items.map((c) => ({
    httpOnly: /httponly/i.test(c),
    secure: /;\s*secure/i.test(c),
    sameSite: (c.match(/samesite=([^;]+)/i) ?? [])[1] ?? null,
    path: (c.match(/path=([^;]+)/i) ?? [])[1] ?? null,
  }));
}

async function signIn(email, password) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 && attempt === 1) {
      await res.arrayBuffer();
      await sleep(65_000);
      continue;
    }
    if (!res.ok) {
      await res.arrayBuffer();
      throw new Error(`Login gagal (HTTP ${res.status}).`);
    }
    const cookies = (res.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .filter((p) => p.includes("="));
    await res.arrayBuffer();
    return { cookie: cookies.join("; "), attrs: cookieAttributes(res) };
  }
  throw new Error("Login gagal setelah retry.");
}

const results = [];
const loginInfo = {};

async function probe(spec) {
  const {
    id,
    category,
    role = null,
    method = "GET",
    path,
    origin = null,
    body = undefined,
    expect,
    note = "",
  } = spec;

  const headers = {};
  if (role) headers.cookie = loginInfo[role].cookie;
  if (origin === "evil") headers.origin = "https://evil.example";
  if (origin === "same") headers.origin = BASE;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (spec.requestId) headers["x-request-id"] = spec.requestId;

  const started = Date.now();
  let status = 0;
  let errorCode = null;
  let message = null;
  let redirectTo = null;
  let echoedRequestId = null;
  const interesting = {};

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(spec.timeoutMs ?? 20_000),
    });
    status = res.status;
    redirectTo = res.headers.get("location")
      ? new URL(res.headers.get("location"), BASE).pathname
      : null;
    for (const h of [
      "ratelimit-limit",
      "ratelimit-remaining",
      "ratelimit-reset",
      "retry-after",
      "content-type",
      "content-disposition",
      "x-request-id",
    ]) {
      if (res.headers.get(h)) interesting[h] = res.headers.get(h);
    }
    if (spec.captureHeaders) {
      for (const h of [
        "content-security-policy",
        "strict-transport-security",
        "x-frame-options",
        "x-content-type-options",
        "referrer-policy",
        "permissions-policy",
        "cross-origin-opener-policy",
        "cross-origin-resource-policy",
        "x-powered-by",
      ]) {
        interesting[h] = res.headers.get(h) ?? "(absent)";
      }
    }
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const text = await res.text();
      if (text.length < 50_000) {
        const json = JSON.parse(text);
        errorCode = json?.error?.code ?? null;
        const msg = json?.error?.message;
        message = typeof msg === "string" ? msg.slice(0, 160) : null;
        echoedRequestId = json?.meta?.requestId ?? null;
      } else {
        await res.arrayBuffer();
      }
    } else {
      await res.arrayBuffer();
    }
    const expected = Array.isArray(expect) ? expect : [expect];
    results.push({
      id,
      category,
      role: role ?? "anon",
      method,
      path,
      origin: origin ?? "none",
      status,
      expected,
      pass: expected.includes(status),
      errorCode,
      message,
      redirectTo,
      echoedRequestId,
      headers: interesting,
      durationMs: Date.now() - started,
      note,
    });
  } catch (error) {
    results.push({
      id,
      category,
      role: role ?? "anon",
      method,
      path,
      origin: origin ?? "none",
      status: 0,
      expected,
      pass: false,
      errorCode: "NETWORK_ERROR",
      message: String(error?.message ?? error).slice(0, 160),
      redirectTo,
      echoedRequestId,
      headers: interesting,
      durationMs: Date.now() - started,
      note,
    });
  }
  await sleep(DELAY_MS);
}

const accountsFile = latestAccountsFile();
if (!accountsFile)
  throw new Error("File .secrets/demo-accounts-*.txt tidak ada.");
const { password, emails } = readAccounts(accountsFile);
for (const role of [
  "MASTER_ADMIN",
  "REGIONAL_ADMIN",
  "BRANCH_ADMIN",
  "STAKEHOLDER",
]) {
  const email = emails[role];
  if (!email) throw new Error(`Email ${role} tidak ditemukan.`);
  const res = await signIn(email, password);
  loginInfo[role] = res;
  await sleep(500);
}

await probe({
  id: "P-001",
  category: "auth",
  path: "/api/v1/me",
  expect: 401,
  note: "Unauth API harus 401",
});
await probe({
  id: "P-002",
  category: "auth",
  path: "/api/v1/admin/users",
  expect: 401,
});
await probe({
  id: "P-003",
  category: "auth",
  path: "/api/v1/submissions",
  expect: 401,
});
await probe({
  id: "P-004",
  category: "auth",
  path: "/api/v1/map",
  expect: 401,
});
await probe({
  id: "P-005",
  category: "auth",
  path: "/api/v1/analytics/series",
  expect: 401,
});
await probe({
  id: "P-006",
  category: "auth",
  path: "/api/v1/reports/performance",
  expect: 401,
});
await probe({
  id: "P-007",
  category: "auth",
  path: "/api/v1/exports/submissions",
  expect: 401,
});
await probe({
  id: "P-008",
  category: "auth",
  path: "/api/v1/notifications",
  expect: 401,
});
await probe({
  id: "P-009",
  category: "auth",
  method: "HEAD",
  path: "/api/v1/admin/imports",
  expect: [401, 405],
  note: "HARAPAN AMAN: 401/405. 204 berarti endpoint terbuka tanpa auth.",
});
await probe({
  id: "P-010",
  category: "auth",
  path: "/api/v1/admin/imports",
  expect: 401,
});

for (const [id, path] of [
  ["P-011", "/admin"],
  ["P-012", "/wilayah"],
  ["P-013", "/cabang"],
  ["P-014", "/client"],
  ["P-015", "/ganti-password"],
]) {
  await probe({
    id,
    category: "page-guard",
    path,
    expect: 307,
    note: "Redirect ke /masuk tanpa sesi",
  });
}
await probe({
  id: "P-016",
  category: "page-guard",
  path: "/aktivasi-lokasi",
  expect: 307,
});

await probe({
  id: "P-017",
  category: "headers",
  path: "/",
  expect: 200,
  captureHeaders: true,
});
await probe({
  id: "P-018",
  category: "headers",
  path: "/api/health",
  expect: 200,
});
await probe({
  id: "P-019",
  category: "method",
  method: "POST",
  path: "/api/health",
  body: "{}",
  expect: [405],
});
await probe({
  id: "P-020",
  category: "method",
  method: "DELETE",
  path: "/api/v1/me",
  expect: [405],
});

await probe({
  id: "P-021",
  category: "bfla-get",
  role: "STAKEHOLDER",
  path: "/api/v1/admin/users",
  expect: 403,
});
await probe({
  id: "P-022",
  category: "bfla-get",
  role: "STAKEHOLDER",
  path: "/api/v1/dashboard/admin",
  expect: 403,
});
await probe({
  id: "P-023",
  category: "bfla-get",
  role: "STAKEHOLDER",
  path: "/api/v1/admin/targets",
  expect: 403,
});
await probe({
  id: "P-024",
  category: "bfla-get",
  role: "STAKEHOLDER",
  path: "/api/v1/admin/edufast/policies",
  expect: 403,
});
await probe({
  id: "P-025",
  category: "bfla-get",
  role: "STAKEHOLDER",
  path: "/api/v1/admin/reviews",
  expect: 403,
});
await probe({
  id: "P-026",
  category: "bfla-get",
  role: "REGIONAL_ADMIN",
  path: "/api/v1/admin/users",
  expect: 403,
});
await probe({
  id: "P-027",
  category: "bfla-get",
  role: "REGIONAL_ADMIN",
  path: "/api/v1/admin/reviews",
  expect: 403,
});
await probe({
  id: "P-028",
  category: "bfla-get",
  role: "REGIONAL_ADMIN",
  path: "/api/v1/dashboard/admin",
  expect: 403,
});
await probe({
  id: "P-029",
  category: "bfla-get",
  role: "BRANCH_ADMIN",
  path: "/api/v1/admin/users",
  expect: 403,
});
await probe({
  id: "P-030",
  category: "bfla-get",
  role: "BRANCH_ADMIN",
  path: "/api/v1/admin/edufast/policies",
  expect: 403,
});
await probe({
  id: "P-031",
  category: "scope-get",
  role: "STAKEHOLDER",
  path: "/api/v1/submissions?limit=1",
  expect: 200,
});
await probe({
  id: "P-032",
  category: "scope-get",
  role: "REGIONAL_ADMIN",
  path: "/api/v1/submissions?limit=1",
  expect: 200,
});
await probe({
  id: "P-033",
  category: "scope-get",
  role: "BRANCH_ADMIN",
  path: "/api/v1/submissions?limit=1",
  expect: 200,
});
await probe({
  id: "P-034",
  category: "scope-get",
  role: "MASTER_ADMIN",
  path: "/api/v1/submissions?limit=1",
  expect: 200,
});
await probe({
  id: "P-035",
  category: "bola-get",
  role: "STAKEHOLDER",
  path: `/api/v1/submissions/${NIL_UUID}`,
  expect: [403, 404],
});
await probe({
  id: "P-036",
  category: "bola-get",
  role: "REGIONAL_ADMIN",
  path: `/api/v1/submissions/${NIL_UUID}`,
  expect: [403, 404],
});
await probe({
  id: "P-037",
  category: "bola-get",
  role: "MASTER_ADMIN",
  path: `/api/v1/submissions/${NIL_UUID}`,
  expect: [403, 404],
});
await probe({
  id: "P-038",
  category: "input",
  role: "MASTER_ADMIN",
  path: "/api/v1/submissions/not-a-uuid",
  expect: [400, 404],
  note: "Path param non-UUID tidak boleh 500",
});
await probe({
  id: "P-039",
  category: "bfla-get",
  role: "BRANCH_ADMIN",
  path: "/api/v1/admin/reviews?limit=1",
  expect: 200,
  note: "BRANCH_ADMIN memang boleh review",
});

await probe({
  id: "P-040",
  category: "csrf",
  role: "MASTER_ADMIN",
  method: "POST",
  path: "/api/v1/admin/branches",
  origin: "evil",
  body: "{}",
  expect: 403,
  note: "Origin asing harus ditolak sebelum validasi",
});
await probe({
  id: "P-041",
  category: "csrf",
  role: "MASTER_ADMIN",
  method: "POST",
  path: "/api/v1/admin/branches",
  origin: null,
  body: "{}",
  expect: 400,
  note: "Tanpa Origin: guard short-circuit lalu validasi 400",
});
await probe({
  id: "P-042",
  category: "csrf",
  role: "STAKEHOLDER",
  method: "POST",
  path: "/api/v1/submissions",
  origin: "evil",
  body: "{}",
  expect: 403,
  note: "HARAPAN AMAN: 403. 400 berarti assertSameOrigin tidak ada.",
});
await probe({
  id: "P-043",
  category: "csrf",
  role: "STAKEHOLDER",
  method: "PATCH",
  path: "/api/v1/notifications",
  origin: "evil",
  body: "{}",
  expect: 403,
});
await probe({
  id: "P-044",
  category: "csrf",
  role: "STAKEHOLDER",
  method: "POST",
  path: "/api/v1/me/password",
  origin: "evil",
  body: JSON.stringify({
    currentPassword: "audit-wrong-password-123",
    newPassword: "audit-new-password-123",
  }),
  expect: 403,
  note: "Password salah; tidak ada perubahan. HARAPAN AMAN: 403.",
});
await probe({
  id: "P-045",
  category: "demo-containment",
  role: "MASTER_ADMIN",
  method: "POST",
  path: "/api/v1/admin/edufast/policies/publish",
  origin: "same",
  body: JSON.stringify({ policyId: NIL_UUID }),
  expect: 403,
  note: "HARAPAN AMAN: 403 demo. 404 berarti guard demo tidak ada.",
});
await probe({
  id: "P-046",
  category: "demo-containment",
  role: "MASTER_ADMIN",
  method: "POST",
  path: `/api/v1/admin/contents/${NIL_UUID}/revoke`,
  origin: "same",
  body: JSON.stringify({ reason: "audit probe - tidak ada perubahan" }),
  expect: 403,
  note: "Step-up diharapkan 403 lebih dulu",
});
await probe({
  id: "P-047",
  category: "demo-containment",
  role: "MASTER_ADMIN",
  method: "POST",
  path: "/api/v1/admin/targets",
  origin: "same",
  body: "{}",
  expect: 403,
  note: "Step-up diharapkan 403 lebih dulu",
});
await probe({
  id: "P-048",
  category: "demo-containment",
  role: "MASTER_ADMIN",
  method: "POST",
  path: "/api/v1/admin/imports/content/preview",
  origin: "same",
  body: JSON.stringify({ filename: "audit.csv", content: "a,b" }),
  expect: 403,
  note: "Kontrol positif: guard demo import konten harus 403",
});
await probe({
  id: "P-049",
  category: "bfla-post",
  role: "REGIONAL_ADMIN",
  method: "POST",
  path: "/api/v1/admin/reviews",
  origin: "same",
  body: "{}",
  expect: 403,
});

await probe({
  id: "P-050",
  category: "bfla-post",
  role: "BRANCH_ADMIN",
  method: "POST",
  path: "/api/v1/admin/reviews",
  origin: "same",
  body: JSON.stringify({
    submissionId: NIL_UUID,
    expectedVersion: 1,
    action: "APPROVE",
    checklist: {
      relevansiTema: true,
      akurasiKonten: true,
      kelengkapanTautan: true,
      etikaDanPrivasi: true,
    },
  }),
  expect: [400, 403, 404],
  note: "ID tidak ada; tidak ada mutasi. Rate-limit row insidental.",
});
await probe({
  id: "P-051",
  category: "requestid",
  path: "/api/v1/me",
  requestId: "audit-probe-echo-001",
  expect: 401,
  note: "Cek apakah x-request-id klien diterima apa adanya",
});
await probe({
  id: "P-052",
  category: "body-limit",
  role: "STAKEHOLDER",
  method: "POST",
  path: "/api/v1/submissions",
  origin: "same",
  body: JSON.stringify({ title: "A".repeat(2 * 1024 * 1024) }),
  expect: 400,
  timeoutMs: 60_000,
  note: "2 MB JSON invalid schema; 413 berarti ada cap",
});
await probe({
  id: "P-053",
  category: "export",
  role: "MASTER_ADMIN",
  path: "/api/v1/exports/performance?period=2026-10",
  expect: 200,
});
await probe({
  id: "P-054",
  category: "imports",
  role: "MASTER_ADMIN",
  path: "/api/v1/admin/imports",
  expect: 200,
});

const summary = {
  base: BASE,
  timestamp: new Date().toISOString(),
  credentialSource: accountsFile,
  cookieAttributes: Object.fromEntries(
    Object.entries(loginInfo).map(([role, v]) => [role, v.attrs]),
  ),
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  results,
};

console.log(JSON.stringify(summary, null, 2));
