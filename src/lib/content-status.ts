export const CONTENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "REVISION_REQUIRED",
  "APPROVED",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: unknown): value is ContentStatus {
  return (
    typeof value === "string" &&
    (CONTENT_STATUSES as readonly string[]).includes(value)
  );
}

export const PENDING_STATUSES = ["SUBMITTED"] as const;
export type PendingStatus = (typeof PENDING_STATUSES)[number];

export function isPendingStatus(status: string): status is PendingStatus {
  return (PENDING_STATUSES as readonly string[]).includes(status);
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Terkirim",
  REVISION_REQUIRED: "Perlu Revisi",
  APPROVED: "Disetujui",
};

export const STATUS_TONE: Record<ContentStatus, string> = {
  DRAFT: "border-border bg-surface-muted text-ink-muted",
  SUBMITTED: "border-brand-blue-500/25 bg-brand-blue-100 text-brand-blue-800",
  REVISION_REQUIRED:
    "border-status-revision/25 bg-status-revision/10 text-status-revision",
  APPROVED:
    "border-status-approved/25 bg-status-approved/10 text-status-approved",
};

/**
 * Pre-v3.6 values that can still be present during the deploy→migration
 * window or after a rollback. Reads must normalize before rendering.
 */
export const LEGACY_STATUS_MAP: Record<string, ContentStatus> = {
  RESUBMITTED: "SUBMITTED",
  IN_REVIEW: "SUBMITTED",
  REJECTED: "REVISION_REQUIRED",
  REVOKED: "REVISION_REQUIRED",
  ARCHIVED: "APPROVED",
};

/** Unknown values fall back to DRAFT so no legacy row is ever treated as approved. */
export function normalizeStatus(
  value: string | null | undefined,
): ContentStatus {
  if (!value) return "DRAFT";
  if (isContentStatus(value)) return value;
  return LEGACY_STATUS_MAP[value] ?? "DRAFT";
}

const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REVISION_REQUIRED"],
  REVISION_REQUIRED: ["SUBMITTED"],
  APPROVED: ["REVISION_REQUIRED"],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const PLATFORM_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  X: "X",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  WEBSITE: "Website",
  LAINNYA: "Lainnya",
};

export const PLATFORMS = Object.keys(PLATFORM_LABEL);

export function isPlatform(value: unknown): value is string {
  return typeof value === "string" && PLATFORMS.includes(value);
}
