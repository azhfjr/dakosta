import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const SUB_THEMES = [
  "MOBILE_JKN",
  "TESTIMONI_PESERTA",
  "ALUR_BEROBAT",
  "EDUKATIF_PERSUASIF",
  "KORPORAT",
  "INFORMASI",
] as const;

export const edufastMonthlyPolicies = pgTable(
  "edufast_monthly_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodYyyyMm: text("period_yyyy_mm").notNull(),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    explanation: text("explanation"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    publishedAt: instant("published_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("edufast_policies_period_idx").on(table.periodYyyyMm),
    uniqueIndex("edufast_policies_published_period_unique")
      .on(table.periodYyyyMm)
      .where(sql`${table.status} = 'PUBLISHED'`),
    check(
      "edufast_policies_period_check",
      sql`${table.periodYyyyMm} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "edufast_policies_status_check",
      sql`${table.status} in ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("edufast_policies_version_check", sql`${table.version} >= 1`),
  ],
);

export const edufastPolicySubthemes = pgTable(
  "edufast_policy_subthemes",
  {
    policyId: uuid("policy_id")
      .notNull()
      .references(() => edufastMonthlyPolicies.id, { onDelete: "cascade" }),
    subTheme: text("sub_theme").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.policyId, table.subTheme] }),
    check(
      "edufast_policy_subthemes_check",
      sql`${table.subTheme} in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI')`,
    ),
  ],
);

export const edufastPolicyEvents = pgTable(
  "edufast_policy_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => edufastMonthlyPolicies.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown> | null>(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("edufast_policy_events_policy_idx").on(table.policyId),
    check(
      "edufast_policy_events_action_check",
      sql`${table.action} in ('CREATED', 'UPDATED', 'PUBLISHED', 'ARCHIVED', 'COPIED')`,
    ),
  ],
);
