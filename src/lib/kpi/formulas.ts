import type { AppRole } from "@/lib/authz/types";
import type { ContentStatus } from "@/lib/content-status";
import type { SubTheme } from "@/lib/taxonomy";

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type AttributionMode = "approved_at" | "date_created";

export type KpiFilters = {
  month: string;
  /** Selected reporting period (`YYYY-MM`, `YYYY-Q1..Q4`, or `YYYY`). */
  periodKey?: string;
  attribution: AttributionMode;
  stakeholderId: string | null;
  subTheme: SubTheme | null;
};

export type MonthRange = {
  key: string;
  previousKey: string;
  label: string;
  shortLabel: string;
  startInstant: Date;
  endInstant: Date;
  startLocal: string;
  endLocal: string;
  dayCount: number;
};

export type TargetSource =
  | "GLOBAL"
  | "STAKEHOLDER"
  | "SUB_THEME"
  | "STAKEHOLDER_SUB_THEME"
  | "AGGREGATE";

export type KpiMetric = {
  value: number;
  target: number | null;
  achievement: number | null;
  targetSource: TargetSource | null;
};

export type StatusTotal = { status: ContentStatus; total: number };

export type TrendPoint = { date: string; label: string; total: number };

export type NamedTotal = { id: string; name: string; total: number };

export type DrilldownItem = {
  id: string;
  referenceCode: string;
  title: string | null;
  status: ContentStatus;
  stakeholderId: string;
  stakeholderName: string;
  subTheme: SubTheme | null;
  themeName: string;
  platform: string;
  contentType: string | null;
  dateCreated: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  updatedAt: Date;
};

export type DashboardOverview = {
  filters: KpiFilters;
  period: {
    key: string;
    label: string;
    startLocal: string;
    endLocal: string;
    attributionLabel: string;
  };
  scope: {
    role: AppRole;
    restricted: boolean;
    stakeholderIds: string[];
    stakeholderName: string | null;
    themeName: string | null;
  };
  approved: KpiMetric;
  previousApproved: number;
  growth: number | null;
  submitted: number;
  pending: number;
  revision: number;
  reviewed: number;
  approvedDecisions: number;
  approvalRate: number | null;
  leadTimeMedianDays: number | null;
  leadTimeAverageDays: number | null;
  approvalSamples: number;
  activeStakeholders: number;
  statusCounts: StatusTotal[];
  trend: TrendPoint[];
  themes: NamedTotal[];
  stakeholders: NamedTotal[];
  approvedItems: DrilldownItem[];
  pendingItems: DrilldownItem[];
  recentItems: DrilldownItem[];
  generatedAt: Date;
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function monthKeyFor(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(reference);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function previousMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelFor(year: number, monthIndex: number, short: boolean): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 15)));
}

export function monthRange(key: string): MonthRange {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const monthIndex = month - 1;
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const startLocal = `${key}-01`;
  const endLocal = `${key}-${String(dayCount).padStart(2, "0")}`;

  return {
    key,
    previousKey: previousMonthKey(key),
    label: labelFor(year, monthIndex, false),
    shortLabel: labelFor(year, monthIndex, true),
    startInstant: new Date(Date.UTC(year, monthIndex, 1) - WIB_OFFSET_MS),
    endInstant: new Date(Date.UTC(year, monthIndex + 1, 1) - WIB_OFFSET_MS),
    startLocal,
    endLocal,
    dayCount,
  };
}

export function recentMonthKeys(reference = new Date(), count = 6): string[] {
  const keys: string[] = [];
  let key = monthKeyFor(reference);
  for (let index = 0; index < count; index += 1) {
    keys.push(key);
    key = previousMonthKey(key);
  }
  return keys;
}

export function dayKeys(range: MonthRange): string[] {
  const keys: string[] = [];
  for (let day = 1; day <= range.dayCount; day += 1) {
    keys.push(`${range.key}-${String(day).padStart(2, "0")}`);
  }
  return keys;
}

export function shortDayLabel(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function achievementPercent(
  actual: number,
  target: number | null | undefined,
): number | null {
  if (target == null || target <= 0) return null;
  return roundOne((actual / target) * 100);
}

export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) return null;
  return roundOne(((current - previous) / previous) * 100);
}

export function ratioPercent(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0) return null;
  return roundOne((numerator / denominator) * 100);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return roundOne(sorted[middle]!);
  return roundOne((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return roundOne(total / values.length);
}

export function leadTimeDays(
  submittedAt: Date | null,
  decidedAt: Date | null,
): number | null {
  if (!submittedAt || !decidedAt) return null;
  const diff = decidedAt.getTime() - submittedAt.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / DAY_MS;
}

export function attributionLabel(mode: AttributionMode): string {
  return mode === "approved_at" ? "tanggal disetujui" : "tanggal konten dibuat";
}

export function targetSourceLabel(source: TargetSource | null): string {
  switch (source) {
    case "GLOBAL":
      return "Target workspace";
    case "STAKEHOLDER":
      return "Target stakeholder";
    case "SUB_THEME":
      return "Target tema";
    case "STAKEHOLDER_SUB_THEME":
      return "Target stakeholder + tema";
    case "AGGREGATE":
      return "Akumulasi target stakeholder";
    default:
      return "Target belum ditetapkan";
  }
}
