#!/usr/bin/env node
/**
 * Staging load test. Refuses non-local targets and never prints cookies or
 * credentials. Uses the Playwright demo sessions (or the demo login endpoint)
 * and records p50/p95/p99, throughput, status counts and threshold results.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const AUTH_DIR = join("e2e", ".auth");
const PENDING_FILE = join(".tmp-load-test", "pending.json");
const EVIDENCE_DIR = join("docs", "audit", "evidence");
const RESULTS_DIR = join(".tmp-load-test");

const STATE_FILES = {
  admin: "admin.json",
  regional: "regional.json",
  branch: "branch-a1.json",
  client: "client.json",
};

function arg(name, fallback) {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

function parseDuration(value, fallbackSeconds) {
  if (!value) return fallbackSeconds;
  const match = /^(\d+)(s|m|h)?$/.exec(value.trim());
  if (!match) throw new Error(`Durasi tidak valid: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  return unit === "h" ? amount * 3600 : unit === "m" ? amount * 60 : amount;
}

function assertLocalTarget(baseUrl) {
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`--base-url tidak valid: ${baseUrl}`);
  }
  if (!["localhost", "127.0.0.1"].includes(host)) {
    throw new Error(
      `Uji beban hanya untuk staging lokal (localhost/127.0.0.1), bukan ${host}. Tidak ada permintaan yang dikirim.`,
    );
  }
}

function cookieHeaderFromState(role) {
  const file = join(AUTH_DIR, STATE_FILES[role]);
  if (!existsSync(file)) return null;
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    const cookies = (state.cookies ?? []).filter(
      (cookie) => cookie?.name && cookie?.value,
    );
    if (cookies.length === 0) return null;
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  } catch {
    return null;
  }
}

async function loginDemo(baseUrl, role) {
  const response = await fetch(`${baseUrl}/api/v1/demo/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    throw new Error(`Login demo ${role} gagal (${response.status}).`);
  }
  await response.arrayBuffer();
  const cookies = response.headers.getSetCookie?.() ?? [];
  const pairs = cookies
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair.includes("="));
  if (pairs.length === 0) {
    throw new Error(`Login demo ${role} tidak mengembalikan sesi.`);
  }
  return pairs.join("; ");
}

async function cookieWorks(baseUrl, cookie) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { cookie },
      redirect: "manual",
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function sessionsFor(baseUrl, roles) {
  const sessions = {};
  for (const role of roles) {
    const stored = cookieHeaderFromState(role);
    if (stored && (await cookieWorks(baseUrl, stored))) {
      sessions[role] = stored;
    } else {
      // Stored Playwright state may be older than the last staging reset.
      sessions[role] = await loginDemo(baseUrl, role);
    }
  }
  return sessions;
}

function periodKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function makeRoutes(period) {
  return {
    read: [
      { role: "regional", path: "/wilayah", allow: [] },
      {
        role: "regional",
        path: `/wilayah/dashboard?period=${period}`,
        allow: [],
      },
      {
        role: "regional",
        path: `/wilayah/kinerja?period=${period}`,
        allow: [],
      },
      {
        role: "regional",
        path: `/api/v1/analytics/series?period=${period}`,
        allow: [],
      },
      { role: "regional", path: "/api/v1/map", allow: [] },
      { role: "branch", path: "/cabang", allow: [] },
      { role: "branch", path: `/cabang/dashboard?period=${period}`, allow: [] },
      { role: "branch", path: `/cabang/kinerja?period=${period}`, allow: [] },
      {
        role: "branch",
        path: "/api/v1/admin/reviews?status=ALL&page=1&pageSize=15",
        allow: [],
      },
      { role: "branch", path: "/api/v1/map", allow: [] },
      { role: "admin", path: "/admin", allow: [] },
      {
        role: "admin",
        path: `/api/v1/dashboard/admin?period=${period}`,
        allow: [],
      },
      { role: "client", path: "/client", allow: [] },
      {
        role: "client",
        path: `/api/v1/dashboard/client?month=${period}`,
        allow: [],
      },
    ],
    export: [
      {
        role: "regional",
        path: `/api/v1/exports/submissions?period=${period}&status=APPROVED`,
        allow: [],
      },
      {
        role: "regional",
        path: `/api/v1/exports/performance?period=${period}`,
        allow: [],
      },
      {
        role: "regional",
        path: `/api/v1/reports/performance?period=${period}`,
        allow: [],
        expectPdf: true,
      },
      {
        role: "branch",
        path: `/api/v1/exports/submissions?period=${period}&status=APPROVED`,
        allow: [],
      },
      {
        role: "branch",
        path: `/api/v1/reports/performance?period=${period}`,
        allow: [],
        expectPdf: true,
      },
    ],
  };
}

function loadPending() {
  if (!existsSync(PENDING_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(PENDING_FILE, "utf8"));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function createWorker(vu, options) {
  let state = (vu + 1) * 2654435761;
  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const readRoutes = options.routes.read;
  const exportRoutes = options.routes.export;
  let pendingCursor = vu % Math.max(1, options.pending.length);

  function choose() {
    const roll = random();
    if (options.profile === "export") {
      return exportRoutes[Math.floor(random() * exportRoutes.length)];
    }
    if (options.profile === "soak") {
      return roll < 0.05
        ? exportRoutes[Math.floor(random() * exportRoutes.length)]
        : readRoutes[Math.floor(random() * readRoutes.length)];
    }
    if (
      options.profile === "mixed" &&
      roll < 0.1 &&
      options.pending.length > 0
    ) {
      const item = options.pending[pendingCursor % options.pending.length];
      pendingCursor += 1;
      return {
        role: "branch",
        path: "/api/v1/admin/reviews",
        method: "POST",
        review: item,
      };
    }
    return readRoutes[Math.floor(random() * readRoutes.length)];
  }

  async function request(target) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const headers = { cookie: options.sessions[target.role] };
    let body;
    if (target.method === "POST") {
      headers["content-type"] = "application/json";
      body = JSON.stringify({
        submissionId: target.review.id,
        expectedVersion: target.review.version ?? 1,
        action: "APPROVE",
        checklist: {
          relevansiTema: true,
          akurasiKonten: true,
          kelengkapanTautan: true,
          etikaDanPrivasi: true,
        },
        conflictOfInterest: false,
      });
    }
    const started = performance.now();
    let status = 0;
    let networkError = null;
    let pdfOk = null;
    try {
      const response = await fetch(`${options.baseUrl}${target.path}`, {
        method: target.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
      });
      status = response.status;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (target.expectPdf)
        pdfOk = buffer.subarray(0, 5).toString() === "%PDF-";
    } catch (error) {
      networkError = error?.name === "AbortError" ? "timeout" : "network";
    } finally {
      clearTimeout(timer);
    }
    return {
      ms: performance.now() - started,
      status,
      networkError,
      pdfOk,
      route: `${target.method ?? "GET"} ${target.path.split("?")[0]}`,
    };
  }

  return { choose, request };
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3400").replace(/\/$/, "");
  assertLocalTarget(baseUrl);

  const profile = arg("profile", "read");
  if (!["read", "mixed", "export", "soak"].includes(profile)) {
    throw new Error("--profile harus read|mixed|export|soak.");
  }
  const vus = Number(arg("vus", "50"));
  if (!Number.isInteger(vus) || vus < 1 || vus > 2000) {
    throw new Error("--vus harus 1..2000.");
  }
  const durationSeconds = parseDuration(arg("duration"), 300);
  const rampSeconds = parseDuration(arg("ramp"), 60);
  const maxP95 = Number(arg("max-p95", "2000"));
  const maxP99 = Number(arg("max-p99", "4000"));
  const maxErrorRate = Number(arg("max-error-rate", "0.01"));
  const max5xx =
    arg("max-5xx", undefined) === undefined ? null : Number(arg("max-5xx"));
  const period = arg("period", periodKey());

  const roles =
    profile === "export" || profile === "soak" || profile === "mixed"
      ? ["regional", "branch", "admin", "client"]
      : ["regional", "branch", "admin", "client"];
  const sessions = await sessionsFor(baseUrl, roles);
  const routes = makeRoutes(period);
  const pending = profile === "mixed" ? loadPending() : [];

  console.log(
    `Profil ${profile}: ${vus} VU, durasi ${durationSeconds}s, ramp ${rampSeconds}s, periode ${period}.`,
  );
  console.log(
    `Target ${baseUrl}. Sesi ${roles.length} peran dimuat (nilai tidak dicetak).`,
  );
  if (profile === "mixed") {
    console.log(`Antrean tulis: ${pending.length} item pending sintetis.`);
  }

  const stats = {
    total: 0,
    errors: 0,
    clientErrors: 0,
    expectedClient: 0,
    fiveXx: 0,
    network: 0,
    pdfFailures: 0,
    statusCounts: {},
    durations: [],
    routes: new Map(),
  };
  const maxSamples = 200_000;
  const startedAt = performance.now();
  const endAt = startedAt + durationSeconds * 1000;

  function record(result) {
    stats.total += 1;
    stats.statusCounts[result.networkError ?? result.status] =
      (stats.statusCounts[result.networkError ?? result.status] ?? 0) + 1;
    if (result.networkError) {
      stats.network += 1;
      stats.errors += 1;
    } else if (result.status >= 500) {
      stats.fiveXx += 1;
      stats.errors += 1;
    } else if (result.status >= 300 && result.status < 400) {
      stats.clientErrors += 1;
      stats.errors += 1;
    } else if (result.status >= 400) {
      if (
        result.status === 403 ||
        result.status === 409 ||
        result.status === 429
      ) {
        stats.expectedClient += 1;
      } else {
        stats.clientErrors += 1;
        stats.errors += 1;
      }
    }
    if (result.pdfOk === false) {
      stats.pdfFailures += 1;
      stats.errors += 1;
    }
    if (stats.durations.length < maxSamples) stats.durations.push(result.ms);
    else {
      const index = Math.floor(Math.random() * stats.total);
      if (index < maxSamples) stats.durations[index] = result.ms;
    }
    const route = stats.routes.get(result.route) ?? {
      count: 0,
      errors: 0,
      durations: [],
    };
    route.count += 1;
    if (
      result.networkError ||
      result.status >= 500 ||
      (result.status >= 400 && result.status !== 403 && result.status !== 409)
    ) {
      route.errors += 1;
    }
    if (route.durations.length < 20_000) route.durations.push(result.ms);
    stats.routes.set(result.route, route);
  }

  let progressTimer = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const rps = stats.total / Math.max(1, elapsed);
    console.log(
      `  ${elapsed.toFixed(0)}s: ${stats.total} permintaan, ${rps.toFixed(1)} rps, error ${stats.errors}, 5xx ${stats.fiveXx}.`,
    );
  }, 30_000);

  const workers = [];
  for (let vu = 0; vu < vus; vu += 1) {
    workers.push(
      (async () => {
        const delay = (rampSeconds * 1000 * vu) / Math.max(1, vus);
        await new Promise((resolve) => setTimeout(resolve, delay));
        const worker = createWorker(vu, {
          sessions,
          routes,
          profile,
          pending,
          baseUrl,
        });
        while (performance.now() < endAt) {
          const target = worker.choose();
          const result = await worker.request(target);
          record(result);
        }
      })(),
    );
  }
  await Promise.all(workers);
  clearInterval(progressTimer);

  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const durations = stats.durations.slice().sort((a, b) => a - b);
  const summary = {
    profile,
    vus,
    durationSeconds,
    rampSeconds,
    period,
    baseUrl,
    totalRequests: stats.total,
    throughputRps: round(stats.total / Math.max(1, elapsedSeconds)),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    p99Ms: round(percentile(durations, 99)),
    maxMs: round(durations[durations.length - 1] ?? 0),
    errors: stats.errors,
    errorRate: round(stats.errors / Math.max(1, stats.total), 4),
    clientErrors: stats.clientErrors,
    expectedClientResponses: stats.expectedClient,
    fiveXx: stats.fiveXx,
    networkErrors: stats.network,
    pdfFailures: stats.pdfFailures,
    statusCounts: stats.statusCounts,
    thresholds: { maxP95, maxP99, maxErrorRate, max5xx },
    routes: [...stats.routes.entries()]
      .map(([route, data]) => {
        const routeDurations = data.durations.slice().sort((a, b) => a - b);
        return {
          route,
          count: data.count,
          errors: data.errors,
          p50Ms: round(percentile(routeDurations, 50)),
          p95Ms: round(percentile(routeDurations, 95)),
          p99Ms: round(percentile(routeDurations, 99)),
          maxMs: round(routeDurations[routeDurations.length - 1] ?? 0),
        };
      })
      .sort((a, b) => b.p95Ms - a.p95Ms),
  };

  const failures = [];
  if (summary.p95Ms > maxP95)
    failures.push(`p95 ${summary.p95Ms}ms > ${maxP95}ms`);
  if (summary.p99Ms > maxP99)
    failures.push(`p99 ${summary.p99Ms}ms > ${maxP99}ms`);
  if (summary.errorRate > maxErrorRate) {
    failures.push(`error rate ${summary.errorRate} > ${maxErrorRate}`);
  }
  if (max5xx !== null && summary.fiveXx > max5xx) {
    failures.push(`5xx ${summary.fiveXx} > ${max5xx}`);
  }
  if (summary.pdfFailures > 0)
    failures.push(`PDF tidak valid: ${summary.pdfFailures}`);
  summary.passed = failures.length === 0;
  summary.failures = failures;

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceFile = join(EVIDENCE_DIR, `E-load-${profile}-${stamp}.json`);
  writeFileSync(evidenceFile, JSON.stringify(summary, null, 2), "utf8");

  console.log("");
  console.log(
    `p50 ${summary.p50Ms}ms | p95 ${summary.p95Ms}ms | p99 ${summary.p99Ms}ms`,
  );
  console.log(
    `Total ${summary.totalRequests} (${summary.throughputRps} rps), error ${summary.errors} (${(summary.errorRate * 100).toFixed(2)}%), 5xx ${summary.fiveXx}, 4xx diharapkan ${summary.expectedClientResponses}.`,
  );
  console.log(`Status: ${JSON.stringify(summary.statusCounts)}`);
  for (const route of summary.routes.slice(0, 6)) {
    console.log(
      `  ${route.route}: n=${route.count} p50=${route.p50Ms}ms p95=${route.p95Ms}ms p99=${route.p99Ms}ms`,
    );
  }
  console.log(`Evidence: ${evidenceFile}`);
  if (failures.length > 0) {
    console.error(`GAGAL: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("LULUS: semua ambang beban terpenuhi.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
