export const SYNC_KIND = "INTERNAL_CONSISTENCY" as const;

export const SYNC_STAGES = [
  "SCOPE_AUDIT",
  "APPROVAL_INVARIANTS",
  "TARGET_RECONCILE",
  "CACHE_INVALIDATE",
  "OUTBOX_DRAIN",
  "ANALYTICS_WARM",
] as const;

export type SyncWorkStage = (typeof SYNC_STAGES)[number];
export type SyncStage = "QUEUED" | SyncWorkStage;

export const SYNC_STAGE_LABELS: Record<SyncStage, string> = {
  QUEUED: "Menunggu",
  SCOPE_AUDIT: "Audit cakupan",
  APPROVAL_INVARIANTS: "Invarian persetujuan",
  TARGET_RECONCILE: "Rekonsiliasi target",
  CACHE_INVALIDATE: "Bersihkan cache",
  OUTBOX_DRAIN: "Kuras outbox",
  ANALYTICS_WARM: "Pemanasan analitik",
};

export type SyncStatus =
  "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL" | "CANCELLED";

export type SyncStageReport = {
  stage: SyncWorkStage;
  label: string;
  scanned: number;
  findings: number;
  fixed: number;
  notes: string[];
};

export type SyncSummary = {
  dryRun: boolean;
  hasFindings: boolean;
  stages: SyncStageReport[];
  totals: { scanned: number; findings: number; fixed: number };
  externalConnectors: "BLOCKED";
  externalNote: string;
};

export type SyncJobView = {
  id: string;
  kind: string;
  status: SyncStatus;
  dryRun: boolean;
  stage: SyncStage;
  processed: number;
  total: number | null;
  percent: number | null;
  summary: SyncSummary | null;
  error: string | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  cancelRequested: boolean;
};
