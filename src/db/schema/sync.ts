import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().default("INTERNAL_CONSISTENCY"),
    status: text("status").notNull().default("QUEUED"),
    dryRun: boolean("dry_run").notNull().default(true),
    stage: text("stage").notNull().default("QUEUED"),
    processed: integer("processed").notNull().default(0),
    total: integer("total"),
    summary: jsonb("summary").$type<Record<string, unknown> | null>(),
    error: text("error"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    startedAt: instant("started_at"),
    heartbeatAt: instant("heartbeat_at"),
    finishedAt: instant("finished_at"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sync_jobs_created_idx").on(table.createdAt),
    uniqueIndex("sync_jobs_active_kind_unique")
      .on(table.kind)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
    check(
      "sync_jobs_status_check",
      sql`${table.status} in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED')`,
    ),
    check("sync_jobs_processed_check", sql`${table.processed} >= 0`),
  ],
);
