// Probe TTFB ringan (bukan load test) terhadap 5 rute produksi.
// Serial, 3 pengulangan per rute, jeda 1 detik. Kredensial tidak dicetak.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "https://dakosta-dakosta.vercel.app"
).replace(/\/+$/, "");
const RUN_TS =
  process.env.TTFB_RUN_TS ?? new Date().toISOString().replace(/[:.]/g, "-");
const EVIDENCE = join(
  process.cwd(),
  "docs",
  "audit",
  "v2-audit-2026-11",
  "evidence",
  `E-ttfb-${RUN_TS}.json`,
);

function latestAccountsFile() {
  const dir = join(process.cwd(), ".secrets");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^demo-accounts-.*\.txt$/.test(f))
    .sort();
  return files.length ? join(dir, files[files.length - 1]) : null;
}

function readAccounts(file) {
  const text = readFileSync(file, "utf8");
  const password = /^kata_sandi_bersama=(.+)$/m.exec(text)?.[1]?.trim();
  if (!password) throw new Error("Kata sandi bersama tidak ditemukan.");
  const emails = {};
  for (const line of text.split(/\r?\n/)) {
    const match =
      /^(MASTER_ADMIN|REGIONAL_ADMIN|BRANCH_ADMIN|STAKEHOLDER)\s*\|\s*([^|]+)\s*\|/.exec(
        line,
      );
    if (match && !emails[match[1]]) emails[match[1]] = match[2].trim();
  }
  return { password, emails };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    await res.arrayBuffer();
    throw new Error(`Login gagal (HTTP ${res.status}).`);
  }
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";")[0])
    .filter((pair) => pair.includes("="))
    .join("; ");
  await res.arrayBuffer();
  return cookie;
}

async function measure(route, cookie) {
  const started = performance.now();
  const res = await fetch(`${BASE}${route}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  const headersAt = performance.now();
  const body = await res.text();
  const finished = performance.now();
  return {
    route,
    status: res.status,
    ttfbMs: Math.round(headersAt - started),
    totalMs: Math.round(finished - started),
    bytes: Buffer.byteLength(body, "utf8"),
    cache: res.headers.get("x-vercel-cache"),
    cacheControl: res.headers.get("cache-control"),
  };
}

async function main() {
  const accounts = readAccounts(latestAccountsFile());
  const masterCookie = await signIn(
    accounts.emails.MASTER_ADMIN,
    accounts.password,
  );
  const regionalCookie = await signIn(
    accounts.emails.REGIONAL_ADMIN,
    accounts.password,
  );
  const clientCookie = await signIn(
    accounts.emails.STAKEHOLDER,
    accounts.password,
  );

  const targets = [
    { route: "/", cookie: null, role: "anon" },
    { route: "/masuk", cookie: null, role: "anon" },
    { route: "/admin", cookie: masterCookie, role: "MASTER_ADMIN" },
    {
      route: "/wilayah/dashboard",
      cookie: regionalCookie,
      role: "REGIONAL_ADMIN",
    },
    { route: "/client", cookie: clientCookie, role: "STAKEHOLDER" },
  ];

  const results = [];
  for (const target of targets) {
    const samples = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const sample = await measure(target.route, target.cookie);
        samples.push(sample);
        console.log(
          `[ttfb] ${target.route} #${attempt} status=${sample.status} ttfb=${sample.ttfbMs}ms total=${sample.totalMs}ms bytes=${sample.bytes}`,
        );
      } catch (error) {
        samples.push({
          route: target.route,
          error: String(error).slice(0, 200),
        });
        console.log(
          `[ttfb] ${target.route} #${attempt} ERROR ${String(error).slice(0, 120)}`,
        );
      }
      await sleep(1_000);
    }
    const ok = samples.filter((sample) => typeof sample.ttfbMs === "number");
    const sorted = ok.map((sample) => sample.ttfbMs).sort((a, b) => a - b);
    results.push({
      route: target.route,
      role: target.role,
      samples,
      medianTtfbMs: sorted.length
        ? sorted[Math.floor(sorted.length / 2)]
        : null,
      minTtfbMs: sorted[0] ?? null,
      maxTtfbMs: sorted[sorted.length - 1] ?? null,
    });
  }

  const payload = {
    base: BASE,
    runTimestamp: RUN_TS,
    kind: "single-request-ttfb",
    disclaimer:
      "Bukan load test; hanya 3 permintaan serial per rute dari satu klien.",
    generatedAt: new Date().toISOString(),
    results,
  };
  writeFileSync(EVIDENCE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[ttfb] evidence: ${EVIDENCE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
