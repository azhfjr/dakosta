import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";

import { loadScriptEnv } from "./_env";
import { parsePeriod, periodMonthKeys } from "../src/lib/periods";

const target = loadScriptEnv();

function arg(name: string, fallback?: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

type Scenario =
  "kinerja" | "dashboard" | "map" | "sla" | "ranking" | "monthly" | "detail";
const SCENARIOS: Scenario[] = [
  "kinerja",
  "dashboard",
  "map",
  "sla",
  "ranking",
  "monthly",
  "detail",
];

type PlanNode = {
  "Node Type"?: string;
  "Relation Name"?: string;
  "Total Cost"?: number;
  "Actual Total Time"?: number;
  Plans?: PlanNode[];
};

function collect(node: PlanNode | undefined, result: string[] = []): string[] {
  if (!node) return result;
  if (node["Node Type"]) {
    result.push(
      `${node["Node Type"]}${node["Relation Name"] ? `(${node["Relation Name"]})` : ""}`,
    );
  }
  for (const child of node.Plans ?? []) collect(child, result);
  return result;
}

function sqlFor(scenario: Scenario): string {
  switch (scenario) {
    case "kinerja":
      return `with targets as (
        select stakeholder_id, sum(target_count)::int as target
          from kpi_targets
         where stakeholder_id is not null
           and regional_office_id is null
           and branch_office_id is null
           and theme_id is null
           and sub_theme is null
           and period_start = any($2::date[])
         group by stakeholder_id
      ), approved as (
        select cs.stakeholder_id, count(distinct cs.id)::int as approved
          from content_submissions cs
         where cs.status = 'APPROVED'
           and cs.approved_at >= $3
           and cs.approved_at < $4
           and cs.stakeholder_id in (
             select s.id from stakeholders s where s.branch_office_id = $1
           )
         group by cs.stakeholder_id
      )
      select s.id, s.name, t.target, coalesce(a.approved, 0) as approved
        from stakeholders s
        left join targets t on t.stakeholder_id = s.id
        left join approved a on a.stakeholder_id = s.id
       where s.status = 'ACTIVE' and s.branch_office_id = $1
       order by coalesce(a.approved, 0) desc, s.name
       limit 25`;
    case "dashboard":
      return `select
        count(*)::int as approved,
        count(*) filter (
          where st.organization_type = 'FASKES' and st.faskes_class = 'FKRTL'
        )::int as fkrtl,
        count(*) filter (
          where st.organization_type = 'FASKES'
            and coalesce(st.faskes_class, '') <> 'FKRTL'
        )::int as fktp,
        count(*) filter (where st.organization_type = 'PEMDA')::int as pemda,
        count(*) filter (
          where st.organization_type not in ('FASKES', 'PEMDA')
        )::int as stakeholder
        from content_submissions cs
        join stakeholders st on st.id = cs.stakeholder_id
       where cs.archived = false
         and cs.status = 'APPROVED'
         and cs.approved_at is not null
         and st.branch_office_id = $1`;
    case "map":
      return `select st.id, st.name, st.latitude, st.longitude,
              count(*)::int as total,
              count(*) filter (
                where st.organization_type = 'FASKES' and st.faskes_class = 'FKRTL'
              )::int as fkrtl,
              count(*) filter (
                where st.organization_type = 'FASKES'
                  and coalesce(st.faskes_class, '') <> 'FKRTL'
              )::int as fktp,
              count(*) filter (where st.organization_type = 'PEMDA')::int as pemda,
              count(*) filter (
                where st.organization_type not in ('FASKES', 'PEMDA')
              )::int as stakeholder
         from content_submissions cs
         join stakeholders st on st.id = cs.stakeholder_id
         left join branch_offices b on b.id = st.branch_office_id
        where cs.archived = false
          and cs.status = 'APPROVED'
          and cs.approved_at is not null
          and st.branch_office_id = $1
        group by st.id, st.name, st.branch_office_id, b.name,
                 st.latitude, st.longitude`;
    case "sla":
      return `select cs.status, count(*)::int as total,
              min(cs.first_submitted_at) as oldest,
              max(cs.first_submitted_at) as newest
         from content_submissions cs
        where cs.stakeholder_id in (
          select s.id from stakeholders s
           where s.branch_office_id = $1 and s.status = 'ACTIVE'
        )
          and cs.status = 'SUBMITTED'
        group by cs.status`;
    case "ranking":
      return `with counts as (
        select st.id as stakeholder_id, st.name,
               st.branch_office_id as branch_id, b.name as branch_name,
               count(*)::int as total,
               count(*) filter (
                 where st.organization_type = 'FASKES' and st.faskes_class = 'FKRTL'
               )::int as fkrtl,
               count(*) filter (
                 where st.organization_type = 'FASKES'
                   and coalesce(st.faskes_class, '') <> 'FKRTL'
               )::int as fktp,
               count(*) filter (where st.organization_type = 'PEMDA')::int as pemda,
               count(*) filter (
                 where st.organization_type not in ('FASKES', 'PEMDA')
               )::int as stakeholder
          from content_submissions cs
          join stakeholders st on st.id = cs.stakeholder_id
          left join branch_offices b on b.id = st.branch_office_id
         where cs.archived = false
           and cs.status = 'APPROVED'
           and cs.approved_at is not null
           and st.branch_office_id = $1
         group by st.id, st.name, st.branch_office_id, b.name
      )
      select *, row_number() over (
               order by total desc, lower(name), stakeholder_id
             )::int as position
        from counts
       order by total desc, lower(name), stakeholder_id
       limit 10`;
    case "monthly":
      return `with months as (
        select generate_series($2::date, $3::date, interval '1 month')::date as month_start
      ), approved as (
        select date_trunc(
                 'month',
                 cs.approved_at at time zone 'Asia/Jakarta'
               )::date as month_start,
               count(distinct cs.id)::int as approved
          from content_submissions cs
         where cs.status = 'APPROVED'
           and cs.approved_at is not null
           and cs.archived = false
           and cs.stakeholder_id in (
             select s.id from stakeholders s where s.branch_office_id = $1
           )
           and cs.approved_at >= $2
           and cs.approved_at < $3
         group by 1
      )
      select m.month_start, coalesce(a.approved, 0) as approved
        from months m
        left join approved a on a.month_start = m.month_start
       order by m.month_start`;
    case "detail":
      return `select cs.id, cs.title, cs.status, cs.content_type, cs.platform,
              cs.approved_at, cs.date_created
         from content_submissions cs
        where cs.stakeholder_id in (
          select s.id from stakeholders s where s.branch_office_id = $1
        )
          and cs.status in ('SUBMITTED', 'APPROVED', 'REVISION_REQUIRED')
          and cs.date_created >= $2
          and cs.date_created < $3
        order by cs.date_created desc, cs.id desc
        limit 25 offset 0`;
  }
}

const BUDGETS: Record<Scenario, number> = {
  kinerja: 500,
  dashboard: 1000,
  map: 1000,
  sla: 500,
  ranking: 800,
  monthly: 800,
  detail: 600,
};

async function main(): Promise<void> {
  if (target !== "staging" || process.env.APP_ENV !== "staging") {
    throw new Error(
      "Query plan hanya dijalankan pada --target=staging dengan APP_ENV=staging.",
    );
  }
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const requested = arg("scenario", "all");
  const scenarios: Scenario[] =
    requested === "all"
      ? SCENARIOS
      : SCENARIOS.filter((scenario) => scenario === requested);
  if (scenarios.length === 0) {
    throw new Error(`--scenario harus ${SCENARIOS.join("|")}|all.`);
  }
  const period = parsePeriod(arg("period"), new Date());
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const branchParam = arg("branch");
    const branch = branchParam
      ? { id: branchParam }
      : (
          await pool.query<{ id: string }>(
            "select id from branch_offices where status = 'ACTIVE' order by code limit 1",
          )
        ).rows[0];
    if (!branch)
      throw new Error("Cabang demo tidak ditemukan; jalankan seed demo.");

    const monthStarts = periodMonthKeys(period).map((key) => `${key}-01`);
    const client = await pool.connect();
    try {
      await client.query("set statement_timeout = 15000");
      await client.query("set default_transaction_read_only = on");

      mkdirSync(join("docs", "audit", "evidence"), { recursive: true });
      const results: Array<{
        scenario: Scenario;
        executionMs: number;
        planningMs: number;
        budgetMs: number;
        passed: boolean;
        seqScans: string[];
      }> = [];

      console.log(
        `Periode ${period.key} (${period.startDate}..${period.endDate}), target staging.`,
      );
      for (const scenario of scenarios) {
        const sql = sqlFor(scenario);
        if (!/^\s*(with|select)\b/i.test(sql)) {
          throw new Error("Query plan harus SELECT-only.");
        }
        // Each scenario uses a different placeholder count; sending extra
        // parameters makes Postgres reject the bind message.
        const params =
          scenario === "kinerja"
            ? [branch.id, monthStarts, period.start, period.endExclusive]
            : scenario === "sla" ||
                scenario === "ranking" ||
                scenario === "dashboard" ||
                scenario === "map"
              ? [branch.id]
              : [branch.id, period.start, period.endExclusive];
        const started = performance.now();
        const response = await client.query(
          `explain (analyze, buffers, format json) ${sql}`,
          params,
        );
        const wallMs = performance.now() - started;
        const payload = response.rows[0]?.["QUERY PLAN"] as
          | Array<{
              Plan: PlanNode;
              "Planning Time": number;
              "Execution Time": number;
            }>
          | undefined;
        const entry = payload?.[0];
        const nodes = collect(entry?.Plan);
        const seqScans = nodes.filter((node) => node.startsWith("Seq Scan"));
        const executionMs = entry?.["Execution Time"] ?? wallMs;
        const planningMs = entry?.["Planning Time"] ?? 0;
        const passed = executionMs <= BUDGETS[scenario];

        results.push({
          scenario,
          executionMs: Number(executionMs.toFixed(2)),
          planningMs: Number(planningMs.toFixed(2)),
          budgetMs: BUDGETS[scenario],
          passed,
          seqScans,
        });

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = join(
          "docs",
          "audit",
          "evidence",
          `E-explain-${scenario}-${stamp}.json`,
        );
        writeFileSync(
          file,
          JSON.stringify(
            {
              scenario,
              period: period.key,
              target: "staging",
              generatedAt: new Date().toISOString(),
              sql,
              params: {
                branchId: branch.id,
                monthStarts,
                start: period.start.toISOString(),
                endExclusive: period.endExclusive.toISOString(),
              },
              budgetMs: BUDGETS[scenario],
              passed,
              plan: entry ?? null,
            },
            null,
            2,
          ),
          "utf8",
        );

        console.log(
          `${scenario}: eksekusi ${executionMs.toFixed(1)} ms (anggaran ${BUDGETS[scenario]} ms) ${passed ? "LULUS" : "GAGAL"}; seq scan: ${seqScans.join(", ") || "tidak ada"}.`,
        );
        console.log(`  Evidence: ${file}`);
      }

      const failed = results.filter((result) => !result.passed);
      if (failed.length > 0) {
        console.error(
          `GAGAL: ${failed.map((result) => result.scenario).join(", ")} melebihi anggaran.`,
        );
        process.exitCode = 1;
      } else {
        console.log("LULUS: semua query plan berada di bawah anggaran.");
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
