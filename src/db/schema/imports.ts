import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const accountImports = pgTable(
  "account_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    filename: text("filename").notNull(),
    digest: text("digest").notNull(),
    mode: text("mode").notNull().default("create_only"),
    status: text("status").notNull().default("VALIDATED"),
    idempotencyKey: text("idempotency_key").notNull(),
    previewStats: jsonb("preview_stats").$type<Record<string, number> | null>(),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    createdAt: instant("created_at").defaultNow().notNull(),
    committedAt: instant("committed_at"),
  },
  (table) => [
    unique("account_imports_idempotency_unique").on(table.idempotencyKey),
    index("account_imports_actor_idx").on(table.actorId),
    check(
      "account_imports_mode_check",
      sql`${table.mode} in ('create_only', 'upsert')`,
    ),
    check(
      "account_imports_status_check",
      sql`${table.status} in ('VALIDATED', 'COMMITTED', 'FAILED')`,
    ),
    check("account_imports_row_count_check", sql`${table.rowCount} >= 0`),
  ],
);

export const accountImportRows = pgTable(
  "account_import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => accountImports.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    status: text("status").notNull(),
    normalized: jsonb("normalized").$type<Record<string, unknown> | null>(),
    errors: jsonb("errors").$type<string[] | null>(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("account_import_rows_row_unique").on(
      table.importId,
      table.rowNumber,
    ),
    index("account_import_rows_import_idx").on(table.importId),
    check(
      "account_import_rows_status_check",
      sql`${table.status} in ('VALID', 'INVALID', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED')`,
    ),
    check("account_import_rows_row_number_check", sql`${table.rowNumber} >= 1`),
  ],
);
