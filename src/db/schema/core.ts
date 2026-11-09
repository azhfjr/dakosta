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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { edufastMonthlyPolicies } from "./edufast";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    active: boolean("active").notNull().default(true),
    status: text("status").notNull().default("ACTIVE"),
    displayTitle: text("display_title"),
    locationStatus: text("location_status").notNull().default("PENDING"),
    locationGraceDeadline: instant("location_grace_deadline"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "user_profiles_status_check",
      sql`${table.status} in ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED')`,
    ),
    check(
      "user_profiles_location_status_check",
      sql`${table.locationStatus} in ('PENDING', 'GRACE', 'VERIFIED', 'EXEMPT')`,
    ),
    index("user_profiles_location_status_idx").on(table.locationStatus),
  ],
);

/**
 * One activation fix per account. Coordinates are never editable per content;
 * the browser geolocation call happens once and a failed/denied permission
 * leaves the account PENDING instead of blocking it silently.
 */
export const userActivationLocations = pgTable(
  "user_activation_locations",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracyMeters: doublePrecision("accuracy_meters").notNull(),
    source: text("source").notNull(),
    distanceMeters: doublePrecision("distance_meters"),
    reviewFlag: boolean("review_flag").notNull().default(false),
    consentAt: instant("consent_at").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "user_activation_locations_source_check",
      sql`${table.source} in ('browser_geolocation', 'demo_backfill', 'master_exception')`,
    ),
    check(
      "user_activation_locations_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "user_activation_locations_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
    check(
      "user_activation_locations_accuracy_check",
      sql`${table.accuracyMeters} >= 0`,
    ),
  ],
);

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

export const regionalOffices = pgTable(
  "regional_offices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("regional_offices_code_unique").on(table.code),
    index("regional_offices_status_idx").on(table.status),
    check(
      "regional_offices_status_check",
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
  ],
);

export const branchOffices = pgTable(
  "branch_offices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionalOfficeId: uuid("regional_office_id")
      .notNull()
      .references(() => regionalOffices.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("branch_offices_code_unique").on(table.code),
    index("branch_offices_region_idx").on(table.regionalOfficeId),
    index("branch_offices_status_idx").on(table.status),
    check(
      "branch_offices_status_check",
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
  ],
);

export const stakeholders = pgTable(
  "stakeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      {
        onDelete: "restrict",
      },
    ),
    organizationType: text("organization_type").notNull().default("OTHER"),
    faskesClass: text("faskes_class"),
    faskesCode: text("faskes_code"),
    faskesCodeNormalized: text("faskes_code_normalized"),
    faskesType: text("faskes_type"),
    serviceArea: text("service_area").notNull(),
    addressLabel: text("address_label"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationPrecision: text("location_precision")
      .notNull()
      .default("approximate"),
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
    index("stakeholders_branch_idx").on(table.branchOfficeId),
    index("stakeholders_type_idx").on(table.organizationType),
    uniqueIndex("stakeholders_faskes_code_unique")
      .on(table.faskesCodeNormalized)
      .where(
        sql`${table.organizationType} = 'FASKES' and ${table.faskesCodeNormalized} is not null`,
      ),
    check(
      "stakeholders_organization_type_check",
      sql`${table.organizationType} in ('FASKES', 'PEMDA', 'OTHER')`,
    ),
    check(
      "stakeholders_faskes_class_check",
      sql`${table.faskesClass} is null or ${table.faskesClass} in ('FKTP', 'FKRTL')`,
    ),
    check(
      "stakeholders_faskes_fields_check",
      sql`(
        (${table.organizationType} = 'FASKES'
          and ${table.faskesClass} in ('FKTP', 'FKRTL')
          and ${table.faskesCodeNormalized} is not null
          and length(trim(${table.faskesCodeNormalized})) > 0)
        or
        (${table.organizationType} in ('PEMDA', 'OTHER')
          and ${table.faskesClass} is null
          and ${table.faskesCodeNormalized} is null)
      )`,
    ),
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

export const userMemberships = pgTable(
  "user_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    regionalOfficeId: uuid("regional_office_id").references(
      () => regionalOffices.id,
      { onDelete: "restrict" },
    ),
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      { onDelete: "restrict" },
    ),
    organizationId: uuid("organization_id").references(() => stakeholders.id, {
      onDelete: "restrict",
    }),
    effectiveAt: instant("effective_at").defaultNow().notNull(),
    revokedAt: instant("revoked_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_memberships_active_user_unique")
      .on(table.userId)
      .where(sql`${table.revokedAt} is null`),
    index("user_memberships_role_idx").on(table.role),
    index("user_memberships_region_idx").on(table.regionalOfficeId),
    index("user_memberships_branch_idx").on(table.branchOfficeId),
    index("user_memberships_organization_idx").on(table.organizationId),
    check(
      "user_memberships_role_check",
      sql`${table.role} in ('MASTER_ADMIN', 'REGIONAL_ADMIN', 'BRANCH_ADMIN', 'STAKEHOLDER')`,
    ),
    check(
      "user_memberships_scope_check",
      sql`(
        (${table.role} = 'MASTER_ADMIN'
          and ${table.regionalOfficeId} is null
          and ${table.branchOfficeId} is null
          and ${table.organizationId} is null)
        or (${table.role} = 'REGIONAL_ADMIN'
          and ${table.regionalOfficeId} is not null
          and ${table.branchOfficeId} is null
          and ${table.organizationId} is null)
        or (${table.role} = 'BRANCH_ADMIN'
          and ${table.branchOfficeId} is not null
          and ${table.organizationId} is null)
        or (${table.role} = 'STAKEHOLDER'
          and ${table.organizationId} is not null)
      )`,
    ),
  ],
);

export const organizationTransfers = pgTable(
  "organization_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => stakeholders.id, { onDelete: "cascade" }),
    fromBranchOfficeId: uuid("from_branch_office_id").references(
      () => branchOffices.id,
      { onDelete: "set null" },
    ),
    toBranchOfficeId: uuid("to_branch_office_id")
      .notNull()
      .references(() => branchOffices.id, { onDelete: "restrict" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    effectiveAt: instant("effective_at").defaultNow().notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("organization_transfers_org_idx").on(table.organizationId),
    index("organization_transfers_effective_idx").on(table.effectiveAt),
  ],
);

export const accountInvitations = pgTable(
  "account_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("ACTIVATION"),
    expiresAt: instant("expires_at").notNull(),
    usedAt: instant("used_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("account_invitations_token_unique").on(table.tokenHash),
    index("account_invitations_user_idx").on(table.userId),
    check(
      "account_invitations_purpose_check",
      sql`${table.purpose} in ('ACTIVATION', 'RESET')`,
    ),
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
    stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, {
      onDelete: "set null",
    }),
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
    index("locations_stakeholder_idx").on(table.stakeholderId),
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
    contentType: text("content_type"),
    mainTheme: text("main_theme"),
    subTheme: text("sub_theme"),
    edufastPolicyId: uuid("edufast_policy_id").references(
      () => edufastMonthlyPolicies.id,
      { onDelete: "set null" },
    ),
    edufastPolicyVersion: integer("edufast_policy_version"),
    approvedSnapshot: jsonb("approved_snapshot").$type<Record<
      string,
      unknown
    > | null>(),
    approvedVersion: integer("approved_version"),
    resubmissionCount: integer("resubmission_count").notNull().default(0),
    sourceSubmissionId: uuid("source_submission_id"),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "restrict",
    }),
    dateCreated: date("date_created", { mode: "string" }).notNull(),
    publishedAt: date("published_at", { mode: "string" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    // Snapshots keep historical scope stable when an organization moves branch.
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      {
        onDelete: "set null",
      },
    ),
    regionalOfficeId: uuid("regional_office_id").references(
      () => regionalOffices.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    firstSubmittedAt: instant("first_submitted_at"),
    submittedAt: instant("submitted_at"),
    approvedAt: instant("approved_at"),
    revokedAt: instant("revoked_at"),
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
    index("content_submissions_org_status_date_idx").on(
      table.stakeholderId,
      table.status,
      table.dateCreated,
    ),
    index("content_submissions_status_submitted_idx").on(
      table.status,
      table.submittedAt,
    ),
    index("content_submissions_content_type_idx").on(table.contentType),
    index("content_submissions_main_theme_idx").on(table.mainTheme),
    index("content_submissions_sub_theme_idx").on(table.subTheme),
    index("content_submissions_stakeholder_subtheme_approved_idx").on(
      table.stakeholderId,
      table.subTheme,
      table.approvedAt,
    ),
    index("content_submissions_stakeholder_status_approved_idx").on(
      table.stakeholderId,
      table.status,
      table.approvedAt,
    ),
    index("content_submissions_approved_partial_idx")
      .on(table.approvedAt)
      .where(sql`${table.status} = 'APPROVED'`),
    index("content_submissions_sla_queue_idx").on(
      table.status,
      table.firstSubmittedAt,
    ),
    index("content_submissions_branch_approved_idx").on(
      table.branchOfficeId,
      table.approvedAt,
    ),
    index("content_submissions_region_approved_idx").on(
      table.regionalOfficeId,
      table.approvedAt,
    ),
    index("content_submissions_institution_approved_idx").on(
      table.stakeholderId,
      table.approvedAt,
    ),
    check(
      "content_submissions_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED')`,
    ),
    check(
      "content_submissions_content_type_check",
      sql`${table.contentType} is null or ${table.contentType} in ('VIDEO', 'INFOGRAFIS')`,
    ),
    check(
      "content_submissions_main_theme_check",
      sql`${table.mainTheme} is null or ${table.mainTheme} in ('EDUFAST', 'NON_EDUFAST')`,
    ),
    check(
      "content_submissions_sub_theme_check",
      sql`${table.subTheme} is null or ${table.subTheme} in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI')`,
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
    reviewerRole: text("reviewer_role"),
    reviewerBranchId: uuid("reviewer_branch_id").references(
      () => branchOffices.id,
      { onDelete: "set null" },
    ),
    decisionSource: text("decision_source").notNull().default("NORMAL"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("content_reviews_submission_version_action_unique").on(
      table.submissionId,
      table.version,
      table.action,
    ),
    index("content_reviews_reviewer_idx").on(table.reviewerId),
    index("content_reviews_branch_idx").on(table.reviewerBranchId),
    index("content_reviews_submission_created_idx").on(
      table.submissionId,
      table.createdAt,
    ),
    check(
      "content_reviews_action_check",
      sql`${table.action} in ('APPROVE', 'REQUEST_REVISION', 'REJECT', 'REVOKE')`,
    ),
    check(
      "content_reviews_decision_source_check",
      sql`${table.decisionSource} in ('NORMAL', 'MASTER_OVERRIDE')`,
    ),
  ],
);

export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceLabel: text("workspace_label").notNull().default("Bandung Demo"),
    regionalOfficeId: uuid("regional_office_id").references(
      () => regionalOffices.id,
      { onDelete: "cascade" },
    ),
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      { onDelete: "cascade" },
    ),
    stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, {
      onDelete: "cascade",
    }),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "cascade",
    }),
    subTheme: text("sub_theme"),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    targetCount: integer("target_count").notNull(),
    reportingUnit: text("reporting_unit").notNull().default("konten"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("kpi_targets_period_idx").on(table.periodStart, table.periodEnd),
    index("kpi_targets_stakeholder_subtheme_idx").on(
      table.stakeholderId,
      table.subTheme,
    ),
    uniqueIndex("kpi_targets_scope_unique").on(
      table.periodStart,
      table.periodEnd,
      sql`coalesce(${table.regionalOfficeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.branchOfficeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.stakeholderId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.themeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.subTheme}, '')`,
    ),
    check("kpi_targets_count_check", sql`${table.targetCount} >= 0`),
    check(
      "kpi_targets_sub_theme_check",
      sql`${table.subTheme} is null or ${table.subTheme} in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI')`,
    ),
  ],
);

/** Append-only audit of every institution target mutation. */
export const kpiTargetHistory = pgTable(
  "kpi_target_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id"),
    stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, {
      onDelete: "set null",
    }),
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      {
        onDelete: "set null",
      },
    ),
    regionalOfficeId: uuid("regional_office_id").references(
      () => regionalOffices.id,
      { onDelete: "set null" },
    ),
    themeId: uuid("theme_id"),
    subTheme: text("sub_theme"),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    targetCount: integer("target_count").notNull(),
    changeType: text("change_type").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("kpi_target_history_stakeholder_period_idx").on(
      table.stakeholderId,
      table.periodStart,
    ),
    check(
      "kpi_target_history_change_check",
      sql`${table.changeType} in ('CREATED', 'UPDATED', 'DELETED')`,
    ),
  ],
);

/**
 * SLA targets are opt-in. Without an active policy the UI reports aging and
 * workflow state only (never an invented deadline).
 */
export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetDays: integer("target_days"),
    calendar: text("calendar").notNull().default("24x7"),
    startsAt: text("starts_at").notNull().default("FIRST_SUBMISSION"),
    pausesOnRevision: boolean("pauses_on_revision").notNull().default(false),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sla_policies_active_idx").on(table.active, table.updatedAt),
    check(
      "sla_policies_target_days_check",
      sql`${table.targetDays} is null or ${table.targetDays} > 0`,
    ),
    check(
      "sla_policies_calendar_check",
      sql`${table.calendar} in ('24x7', 'BUSINESS_DAYS')`,
    ),
    check(
      "sla_policies_starts_at_check",
      sql`${table.startsAt} in ('FIRST_SUBMISSION', 'LATEST_SUBMISSION')`,
    ),
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
    branchOfficeId: uuid("branch_office_id").references(
      () => branchOffices.id,
      { onDelete: "set null" },
    ),
    organizationId: uuid("organization_id").references(() => stakeholders.id, {
      onDelete: "set null",
    }),
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
    index("notifications_recipient_created_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    index("notifications_branch_idx").on(table.branchOfficeId),
    index("notifications_organization_idx").on(table.organizationId),
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
    regionId: uuid("region_id").references(() => regionalOffices.id, {
      onDelete: "set null",
    }),
    branchId: uuid("branch_id").references(() => branchOffices.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => stakeholders.id, {
      onDelete: "set null",
    }),
    correlationId: text("correlation_id"),
    reason: text("reason"),
    source: text("source").notNull().default("APP"),
    requestId: text("request_id"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_record_idx").on(table.recordType, table.recordId),
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_region_idx").on(table.regionId),
    index("audit_logs_branch_idx").on(table.branchId),
    index("audit_logs_organization_idx").on(table.organizationId),
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

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    windowStart: instant("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [unique("rate_limits_key_unique").on(table.key)],
);

export const migrationRuns = pgTable(
  "migration_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    targetEnv: text("target_env").notNull(),
    startedAt: instant("started_at").defaultNow().notNull(),
    finishedAt: instant("finished_at"),
    counts: jsonb("counts").$type<Record<string, number>>(),
    checksum: text("checksum"),
    notes: text("notes"),
  },
  (table) => [
    index("migration_runs_name_idx").on(table.name),
    index("migration_runs_target_idx").on(table.targetEnv),
  ],
);
