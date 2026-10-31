import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
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

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
  active: boolean("active").notNull().default(true),
  displayTitle: text("display_title"),
  createdAt: instant("created_at").defaultNow().notNull(),
  updatedAt: instant("updated_at").defaultNow().notNull(),
});

export const userRoleMemberships = pgTable(
  "user_role_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_role_memberships_user_role_unique").on(
      table.userId,
      table.role,
    ),
    check(
      "user_role_memberships_role_check",
      sql`${table.role} in ('ADMIN', 'CLIENT')`,
    ),
  ],
);

export const stakeholders = pgTable(
  "stakeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    faskesType: text("faskes_type"),
    serviceArea: text("service_area").notNull(),
    addressLabel: text("address_label"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationPrecision: text("location_precision").notNull().default("approximate"),
    websiteUrl: text("website_url"),
    socialHandle: text("social_handle"),
    status: text("status").notNull().default("ACTIVE"),
    isDemo: boolean("is_demo").notNull().default(true),
    joinedAt: date("joined_at", { mode: "string" }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("stakeholders_category_idx").on(table.category),
    index("stakeholders_status_idx").on(table.status),
    check(
      "stakeholders_category_check",
      sql`${table.category} in ('FASKES', 'INSTANSI', 'TOKOH', 'MEDIA', 'INFLUENCER', 'ORGANISASI')`,
    ),
    check(
      "stakeholders_status_check",
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    check(
      "stakeholders_precision_check",
      sql`${table.locationPrecision} in ('exact', 'approximate')`,
    ),
    check(
      "stakeholders_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "stakeholders_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
  ],
);

export const userStakeholderMemberships = pgTable(
  "user_stakeholder_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholders.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_stakeholder_memberships_unique").on(
      table.userId,
      table.stakeholderId,
    ),
    index("user_stakeholder_memberships_user_idx").on(table.userId),
  ],
);

export const themes = pgTable(
  "themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [unique("themes_slug_unique").on(table.slug)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    label: text("label").notNull(),
    source: text("source").notNull(),
    accuracyMeters: doublePrecision("accuracy_meters"),
    consentAt: instant("consent_at"),
    verifiedStatus: text("verified_status").notNull(),
    precision: text("precision").notNull().default("approximate"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "locations_source_check",
      sql`${table.source} in ('device_gps', 'manual_pin', 'registered_stakeholder')`,
    ),
    check(
      "locations_verified_status_check",
      sql`${table.verifiedStatus} in ('VERIFIED', 'MANUAL_UNVERIFIED')`,
    ),
    check(
      "locations_precision_check",
      sql`${table.precision} in ('exact', 'approximate')`,
    ),
    check(
      "locations_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "locations_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
  ],
);

export const contentSubmissions = pgTable(
  "content_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceCode: text("reference_code").notNull(),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholders.id, { onDelete: "restrict" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    submittedBy: text("submitted_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    onBehalfOf: text("on_behalf_of").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    narrative: text("narrative").notNull(),
    publishedUrl: text("published_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    normalizedUrlHash: text("normalized_url_hash").notNull(),
    platform: text("platform").notNull(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "restrict" }),
    dateCreated: date("date_created", { mode: "string" }).notNull(),
    publishedAt: date("published_at", { mode: "string" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    submittedAt: instant("submitted_at"),
    approvedAt: instant("approved_at"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
    archived: boolean("archived").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("content_submissions_reference_unique").on(table.referenceCode),
    unique("content_submissions_idempotency_unique").on(table.idempotencyKey),
    index("content_submissions_status_idx").on(table.status),
    index("content_submissions_stakeholder_idx").on(table.stakeholderId),
    index("content_submissions_creator_idx").on(table.createdBy),
    index("content_submissions_theme_idx").on(table.themeId),
    index("content_submissions_date_created_idx").on(table.dateCreated),
    index("content_submissions_approved_at_idx").on(table.approvedAt),
    index("content_submissions_normalized_hash_idx").on(
      table.normalizedUrlHash,
    ),
    check(
      "content_submissions_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'REVOKED', 'ARCHIVED')`,
    ),
    check(
      "content_submissions_platform_check",
      sql`${table.platform} in ('INSTAGRAM', 'FACEBOOK', 'X', 'TIKTOK', 'YOUTUBE', 'WEBSITE', 'LAINNYA')`,
    ),
    check("content_submissions_version_check", sql`${table.version} >= 1`),
  ],
);

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => contentSubmissions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("content_revisions_submission_version_unique").on(
      table.submissionId,
      table.version,
    ),
  ],
);

export const contentReviews = pgTable(
  "content_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => contentSubmissions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull(),
    notes: text("notes"),
    previousStatus: text("previous_status").notNull(),
    nextStatus: text("next_status").notNull(),
    conflictOfInterest: boolean("conflict_of_interest")
      .notNull()
      .default(false),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("content_reviews_submission_version_unique").on(
      table.submissionId,
      table.version,
    ),
    index("content_reviews_reviewer_idx").on(table.reviewerId),
    check(
      "content_reviews_action_check",
      sql`${table.action} in ('APPROVE', 'REQUEST_REVISION', 'REJECT')`,
    ),
  ],
);

export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceLabel: text("workspace_label").notNull().default("Bandung Demo"),
    stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, {
      onDelete: "cascade",
    }),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "cascade",
    }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    targetCount: integer("target_count").notNull(),
    reportingUnit: text("reporting_unit").notNull().default("konten"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("kpi_targets_period_idx").on(table.periodStart, table.periodEnd),
    check("kpi_targets_count_check", sql`${table.targetCount} >= 0`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    objectType: text("object_type"),
    objectId: text("object_id"),
    href: text("href"),
    readAt: instant("read_at"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("notifications_dedupe_unique").on(table.dedupeKey),
    index("notifications_recipient_idx").on(table.recipientId, table.id),
    index("notifications_recipient_read_idx").on(
      table.recipientId,
      table.readAt,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    recipientId: text("recipient_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    notificationId: uuid("notification_id").references(() => notifications.id, {
      onDelete: "set null",
    }),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: instant("next_retry_at"),
    processedAt: instant("processed_at"),
    lastError: text("last_error"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("outbox_events_event_key_unique").on(table.eventKey),
    index("outbox_events_pending_idx").on(table.processedAt, table.nextRetryAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id"),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    requestId: text("request_id"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_record_idx").on(table.recordType, table.recordId),
    index("audit_logs_actor_idx").on(table.actorId),
  ],
);

export const demoRateLimits = pgTable(
  "demo_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    windowStart: instant("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [unique("demo_rate_limits_key_unique").on(table.key)],
);
