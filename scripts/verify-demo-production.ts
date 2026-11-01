import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { verifyPassword } from "better-auth/crypto";
import { sql, type SQL } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import {
  DEMO_ACCOUNTS,
  buildDemoDataset,
  expectedCounts,
  type DemoAccount,
} from "./demo-fixtures";
import {
  collectDemoScope,
  snapshotInvariants,
  type SqlExecutor,
} from "./demo-purge";
import { loadScriptEnv, requireDatabaseUrlForScript } from "./_env";
import { assertSeededCounts } from "./seed-demo-production";

const DEFAULT_BASE_URL = "https://dakosta-dakosta.vercel.app";
const CREDENTIALS_PREFIX = "demo-accounts-";
const DEMO_ACCOUNT_MESSAGE = "Akun demo tidak dapat mengubah akun";
const SUBMISSION_PAGE_CAP = 100;
const MAP_POINT_CAP = 500;
const REVIEW_PAGE_CAP = 50;

type VerifyDb = NeonDatabase<typeof schema>;

type ApiEnvelope<T> = {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code?: string; message: string } | null;
};

type ApiResult<T> = { status: number; body: ApiEnvelope<T> };

type Options = {
  base: string;
  skipDb: boolean;
  skipHttp: boolean;
};

function parseOptions(argv: string[]): Options {
  const target = argv
    .find((value) => value.startsWith("--target="))
    ?.split("=")[1];
  if (target !== "production") {
    throw new Error(
      "Verifikasi demo hanya boleh dijalankan dengan --target=production.",
    );
  }
  const base =
    argv.find((value) => value.startsWith("--base="))?.split("=")[1] ??
    DEFAULT_BASE_URL;
  const skipDb = argv.includes("--skip-db");
  const skipHttp = argv.includes("--skip-http");
  if (skipDb && skipHttp) {
    throw new Error(
      "Tidak ada yang diverifikasi: --skip-db dan --skip-http dipakai bersamaan.",
    );
  }
  return {
    base: base.replace(/\/+$/, ""),
    skipDb,
    skipHttp,
  };
}

function readScalar(reader: SqlExecutor, query: SQL): Promise<number> {
  return reader
    .execute(query)
    .then((result) => Number(result.rows[0]?.value ?? 0));
}

function textIn(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}::text`),
    sql`, `,
  );
}

function readCredentialFromSecrets(): {
  password: string;
  path: string;
} | null {
  const directory = resolve(process.cwd(), ".secrets");
  if (!existsSync(directory)) return null;
  const candidate = readdirSync(directory)
    .filter(
      (name) => name.startsWith(CREDENTIALS_PREFIX) && name.endsWith(".txt"),
    )
    .sort()
    .at(-1);
  if (!candidate) return null;

  const path = join(directory, candidate);
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((value) => value.startsWith("kata_sandi_bersama="));
  const password = line?.slice("kata_sandi_bersama=".length).trim();
  return password ? { password, path: `.secrets/${candidate}` } : null;
}

function resolveDemoPassword(): { password: string; source: string } {
  const fromEnv = process.env.DEMO_SEED_PASSWORD;
  if (fromEnv && fromEnv.length >= 12) {
    return { password: fromEnv, source: "env" };
  }
  const fromFile = readCredentialFromSecrets();
  if (fromFile) {
    return { password: fromFile.password, source: fromFile.path };
  }
  throw new Error(
    "Sandi demo tidak tersedia: set DEMO_SEED_PASSWORD atau sediakan .secrets/demo-accounts-<stamp>.txt hasil seed.",
  );
}

function accountFor(
  role: DemoAccount["role"],
  scope?: { regionN: number } | { branchN: number } | { organizationN: number },
): DemoAccount {
  const account = DEMO_ACCOUNTS.find((candidate) => {
    if (candidate.role !== role) return false;
    if (!scope) return true;
    if ("regionN" in scope) return candidate.regionN === scope.regionN;
    if ("branchN" in scope) return candidate.branchN === scope.branchN;
    return candidate.organizationN === scope.organizationN;
  });
  if (!account) {
    throw new Error(
      `Akun demo ${role} untuk cakupan yang diminta tidak ditemukan.`,
    );
  }
  return account;
}

function expectEqual(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: aktual ${String(actual)}, harapan ${String(expected)}.`,
    );
  }
}

async function verifyDatabase(
  db: VerifyDb,
  password: string,
  expected: ReturnType<typeof expectedCounts>,
  dataset: ReturnType<typeof buildDemoDataset>,
): Promise<void> {
  const scope = collectDemoScope();
  const before = await snapshotInvariants(db);

  if (!before.masterUserId) {
    throw new Error("Master asli admin@dakosta.local tidak ditemukan.");
  }
  if (scope.userIds.includes(before.masterUserId)) {
    throw new Error("ID Master asli bertabrakan dengan akun demo.");
  }
  expectEqual(
    "membership MASTER_ADMIN aktif",
    before.masterAdminMemberships,
    1,
  );
  expectEqual("pengguna demo asing", before.foreignDemoUsers, 0);
  expectEqual("pengguna demo setengah jadi", before.halfDemoUsers, 0);

  await assertSeededCounts(db, dataset, scope, before, expected);

  const accountRows = await db.execute<{
    email: string;
    password: string | null;
  }>(sql`
    select u.email, a.password
      from "user" u
      inner join account a
        on a.user_id = u.id and a.provider_id = 'credential'
     where u.email in (${textIn(scope.emails)})
     order by u.email
  `);

  expectEqual(
    "akun kredensial demo",
    accountRows.rows.length,
    expected.accounts,
  );

  let verified = 0;
  for (const row of accountRows.rows) {
    if (!row.password) {
      throw new Error(`Akun demo ${row.email} tidak memiliki hash sandi.`);
    }
    const ok = await verifyPassword({ password, hash: row.password });
    if (!ok) {
      throw new Error(
        `Kata sandi akun demo ${row.email} tidak cocok dengan kredensial.`,
      );
    }
    verified += 1;
  }
  expectEqual("verifikasi sandi demo", verified, expected.accounts);

  const demoRole = await db.execute<{ email: string; role: string }>(sql`
    select email, role
      from "user"
     where email in (${textIn(scope.emails)})
  `);
  const nonUserRoles = demoRole.rows.filter((row) => row.role !== "user");
  if (nonUserRoles.length > 0) {
    throw new Error(
      `Akun demo memiliki peran better-auth selain "user": ${nonUserRoles
        .map((row) => row.email)
        .join(", ")}.`,
    );
  }

  const run = await db.execute<{
    name: string;
    target_env: string;
    finished_at: Date | null;
    counts: Record<string, number> | null;
  }>(sql`
    select name, target_env, finished_at, counts
      from migration_runs
     where name = 'seed-demo-production'
     order by started_at desc
     limit 1
  `);
  const seedRun = run.rows[0];
  if (!seedRun) {
    throw new Error(
      "Baris migration_runs seed-demo-production tidak ditemukan.",
    );
  }
  if (seedRun.target_env !== "production") {
    throw new Error(
      `migration_runs target_env=${seedRun.target_env}, harapan production.`,
    );
  }
  if (!seedRun.finished_at) {
    throw new Error("Seed demo belum selesai (finished_at kosong).");
  }
  expectEqual(
    "migration_runs submissions",
    Number(seedRun.counts?.submissions ?? 0),
    expected.submissions,
  );

  const nonDemoProfiles = await readScalar(
    db,
    sql`select count(*)::text as value from user_profiles where is_demo = false`,
  );
  expectEqual("profil non-demo", nonDemoProfiles, 1);

  console.log(
    `tier_db=ok akun=${expected.accounts}/${expected.accounts} sandi_ok=${verified} konten=${expected.submissions} approved=${expected.approvedCurrent}/${expected.approvedPrevious} target=${expected.currentTarget}/${expected.previousTarget} nondo_profiles=${nonDemoProfiles}`,
  );
}

async function readCookies(response: Response): Promise<string> {
  const cookies = response.headers.getSetCookie?.() ?? [];
  const pairs = cookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  if (pairs.length === 0) {
    throw new Error("Login berhasil tanpa cookie sesi.");
  }
  return pairs.join("; ");
}

async function signIn(
  base: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Login ${email} gagal (HTTP ${response.status}).`);
  }
  return readCookies(response);
}

async function signOut(base: string, cookie: string): Promise<void> {
  try {
    await fetch(`${base}/api/auth/sign-out`, {
      method: "POST",
      headers: { cookie, origin: base },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Session expiry is irrelevant for a read-only verification run.
  }
}

async function api<T>(
  base: string,
  path: string,
  cookie: string,
): Promise<ApiResult<T>> {
  const response = await fetch(`${base}${path}`, {
    headers: { cookie, origin: base },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

function expectOk<T>(label: string, result: ApiResult<T>): T {
  if (result.status !== 200 || result.body.error || result.body.data === null) {
    throw new Error(
      `${label}: HTTP ${result.status} ${result.body.error?.message ?? ""}`.trim(),
    );
  }
  return result.body.data;
}

async function withSession(
  base: string,
  email: string,
  password: string,
  run: (cookie: string) => Promise<void>,
): Promise<void> {
  const cookie = await signIn(base, email, password);
  try {
    await run(cookie);
  } finally {
    await signOut(base, cookie);
  }
}

async function verifyHttp(
  base: string,
  password: string,
  expected: ReturnType<typeof expectedCounts>,
  dataset: ReturnType<typeof buildDemoDataset>,
): Promise<void> {
  const master = accountFor("MASTER_ADMIN");
  const regional = accountFor("REGIONAL_ADMIN", { regionN: 1 });
  const branch = accountFor("BRANCH_ADMIN", { branchN: 1 });
  const stakeholder = accountFor("STAKEHOLDER", { organizationN: 1 });

  const masuk = await fetch(`${base}/masuk`, {
    signal: AbortSignal.timeout(20_000),
  });
  expectEqual("GET /masuk", masuk.status, 200);

  const unauthorized = await api<unknown>(base, "/api/v1/me", "");
  expectEqual("GET /api/v1/me tanpa sesi", unauthorized.status, 401);

  const demoLogin = await fetch(`${base}/api/v1/demo/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ role: "MASTER_ADMIN" }),
    signal: AbortSignal.timeout(20_000),
  });
  expectEqual("POST /api/v1/demo/login", demoLogin.status, 404);

  const region3Content = dataset.submissions.find((item) => item.regionN === 3);
  const otherBranchContent = dataset.submissions.find(
    (item) => item.branchN === 2,
  );
  if (!region3Content || !otherBranchContent) {
    throw new Error(
      "Fixture tidak memuat konten lintas wilayah/cabang untuk uji isolasi.",
    );
  }

  const stakeholderContent = dataset.submissions.filter(
    (item) => item.organizationN === 1,
  ).length;

  await withSession(base, master.email, password, async (cookie) => {
    const me = expectOk(
      "/api/v1/me",
      await api<{ role: string; isDemo: boolean; capabilities: string[] }>(
        base,
        "/api/v1/me",
        cookie,
      ),
    );
    expectEqual("peran demo master", me.role, "MASTER_ADMIN");
    expectEqual("isDemo", me.isDemo, true);
    for (const capability of [
      "account:manage",
      "account:reset",
      "hierarchy:manage",
      "organization:manage",
      "import:manage",
    ]) {
      if (me.capabilities.includes(capability)) {
        throw new Error(`Demo master masih memiliki capability ${capability}.`);
      }
    }

    const current = expectOk(
      "dashboard bulan berjalan",
      await api<{ approved: { value: number; target: number | null } }>(
        base,
        `/api/v1/dashboard/admin?month=${expected.currentPeriod}`,
        cookie,
      ),
    );
    expectEqual(
      "approved bulan berjalan",
      current.approved.value,
      expected.approvedCurrent,
    );
    expectEqual(
      "target bulan berjalan",
      current.approved.target ?? -1,
      expected.currentTarget,
    );

    const previous = expectOk(
      "dashboard bulan sebelumnya",
      await api<{ approved: { value: number; target: number | null } }>(
        base,
        `/api/v1/dashboard/admin?month=${expected.previousPeriod}`,
        cookie,
      ),
    );
    expectEqual(
      "approved bulan sebelumnya",
      previous.approved.value,
      expected.approvedPrevious,
    );
    expectEqual(
      "target bulan sebelumnya",
      previous.approved.target ?? -1,
      expected.previousTarget,
    );

    const oldest = expectOk(
      "dashboard bulan tertua",
      await api<{ approved: { value: number; target: number | null } }>(
        base,
        `/api/v1/dashboard/admin?month=${expected.oldestPeriod}`,
        cookie,
      ),
    );
    expectEqual(
      "approved bulan tertua",
      oldest.approved.value,
      expected.approvedOldest,
    );
    expectEqual(
      "target bulan tertua",
      oldest.approved.target ?? -1,
      expected.oldestTarget,
    );

    const submissions = expectOk(
      "daftar konten master",
      await api<unknown[]>(base, "/api/v1/submissions?limit=100", cookie),
    );
    expectEqual(
      "konten master",
      submissions.length,
      Math.min(SUBMISSION_PAGE_CAP, expected.submissions),
    );

    const map = expectOk(
      "peta master",
      await api<{ points: unknown[]; totals: { points: number } }>(
        base,
        "/api/v1/map",
        cookie,
      ),
    );
    expectEqual(
      "titik peta",
      map.points.length,
      Math.min(MAP_POINT_CAP, expected.mapPoints),
    );
    expectEqual("total titik peta", map.totals.points, expected.mapPoints);

    const created = await fetch(`${base}/api/v1/admin/users`, {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20_000),
    });
    const createdBody = (await created.json()) as ApiEnvelope<unknown>;
    expectEqual("POST akun oleh demo master", created.status, 403);
    if (!createdBody.error?.message.includes(DEMO_ACCOUNT_MESSAGE)) {
      throw new Error(
        `Penjagaan akun demo tidak aktif: "${createdBody.error?.message ?? ""}".`,
      );
    }
  });

  await withSession(base, regional.email, password, async (cookie) => {
    const submissions = expectOk(
      "konten wilayah A",
      await api<unknown[]>(base, "/api/v1/submissions?limit=100", cookie),
    );
    expectEqual(
      "konten wilayah A",
      submissions.length,
      Math.min(SUBMISSION_PAGE_CAP, expected.regionSubmissions[0]!),
    );

    const cross = await api<unknown>(
      base,
      `/api/v1/submissions/${region3Content.id}`,
      cookie,
    );
    if (cross.status !== 404 && cross.status !== 403) {
      throw new Error(`Isolasi wilayah gagal: HTTP ${cross.status}.`);
    }
  });

  await withSession(base, branch.email, password, async (cookie) => {
    const queue = expectOk(
      "antrean cabang A1",
      await api<{ items: unknown[]; total: number }>(
        base,
        "/api/v1/admin/reviews?status=ALL",
        cookie,
      ),
    );
    expectEqual("antrean cabang A1", queue.total, expected.branchPending[0]!);
    expectEqual(
      "item antrean cabang A1",
      queue.items.length,
      Math.min(REVIEW_PAGE_CAP, expected.branchPending[0]!),
    );

    const cross = await api<unknown>(
      base,
      `/api/v1/submissions/${otherBranchContent.id}`,
      cookie,
    );
    if (cross.status !== 404 && cross.status !== 403) {
      throw new Error(`Isolasi cabang gagal: HTTP ${cross.status}.`);
    }
  });

  await withSession(base, stakeholder.email, password, async (cookie) => {
    const submissions = expectOk(
      "konten mitra",
      await api<unknown[]>(base, "/api/v1/submissions?limit=100", cookie),
    );
    expectEqual(
      "konten mitra",
      submissions.length,
      Math.min(SUBMISSION_PAGE_CAP, stakeholderContent),
    );

    for (const path of ["/client", "/client/konten"]) {
      const page = await fetch(`${base}${path}`, {
        headers: { cookie },
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      expectEqual(`GET ${path}`, page.status, 200);
    }
  });

  console.log(
    `tier_http=ok base=${base} login=4 smoke=3 konten_master=${expected.submissions} peta=${expected.mapPoints} wilayah_a=${expected.regionSubmissions[0]} cabang_a1=${expected.branchPending[0]} mitra_01=${stakeholderContent}`,
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  loadScriptEnv("production");

  const now = new Date();
  const dataset = buildDemoDataset(now);
  const expected = expectedCounts(now);
  const { password, source } = resolveDemoPassword();

  console.log(
    `verifikasi: target=production base=${options.base} periode=${expected.currentPeriod}/${expected.previousPeriod}`,
  );
  console.log(
    `kredensial: sumber=${source} (nilai tidak dicetak) tier_db=${options.skipDb ? "skip" : "on"} tier_http=${options.skipHttp ? "skip" : "on"}`,
  );

  if (!options.skipDb) {
    const pool = new Pool({
      connectionString: requireDatabaseUrlForScript(),
      max: 1,
    });
    const db = drizzle(pool, { schema });
    try {
      await verifyDatabase(db, password, expected, dataset);
    } finally {
      await pool.end();
    }
  }

  if (!options.skipHttp) {
    await verifyHttp(options.base, password, expected, dataset);
  }

  console.log("Verifikasi demo produksi lulus. Tidak ada data yang ditulis.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
