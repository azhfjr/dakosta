export const CONTENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RESUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REVISION_REQUIRED",
  "REJECTED",
  "REVOKED",
  "ARCHIVED",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const PENDING_STATUSES = [
  "SUBMITTED",
  "RESUBMITTED",
  "IN_REVIEW",
] as const;
export type PendingStatus = (typeof PENDING_STATUSES)[number];

export function isPendingStatus(status: string): status is PendingStatus {
  return (PENDING_STATUSES as readonly string[]).includes(status);
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Terkirim",
  RESUBMITTED: "Dikirim ulang",
  IN_REVIEW: "Ditinjau",
  APPROVED: "Disetujui",
  REVISION_REQUIRED: "Perlu revisi",
  REJECTED: "Ditolak",
  REVOKED: "Dicabut",
  ARCHIVED: "Diarsipkan",
};

export const STATUS_TONE: Record<ContentStatus, string> = {
  DRAFT: "border-border bg-surface-muted text-ink-muted",
  SUBMITTED: "border-brand-blue-500/25 bg-brand-blue-100 text-brand-blue-800",
  RESUBMITTED: "border-brand-blue-500/40 bg-brand-blue-100 text-brand-blue-800",
  IN_REVIEW: "border-status-review/25 bg-status-review/10 text-status-review",
  APPROVED:
    "border-status-approved/25 bg-status-approved/10 text-status-approved",
  REVISION_REQUIRED:
    "border-status-revision/25 bg-status-revision/10 text-status-revision",
  REJECTED:
    "border-status-rejected/25 bg-status-rejected/10 text-status-rejected",
  REVOKED: "border-border bg-surface-muted text-ink-muted",
  ARCHIVED: "border-border bg-surface-muted text-ink-muted",
};

const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_REVIEW", "APPROVED", "REVISION_REQUIRED", "REJECTED"],
  RESUBMITTED: ["IN_REVIEW", "APPROVED", "REVISION_REQUIRED", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REVISION_REQUIRED", "REJECTED"],
  APPROVED: ["REVOKED", "ARCHIVED"],
  REVISION_REQUIRED: ["SUBMITTED", "RESUBMITTED"],
  REJECTED: [],
  REVOKED: [],
  ARCHIVED: [],
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
