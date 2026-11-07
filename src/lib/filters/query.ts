import { isOrgSource, type OrgSource } from "@/lib/analytics/org-source";
import {
  CONTENT_STATUSES,
  isPlatform,
  type ContentStatus,
} from "@/lib/content-status";
import { parseOrgType, type OrgTypeFilter } from "@/lib/filters/org-type";
import {
  isContentType,
  isMainTheme,
  isSubTheme,
  type ContentType,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";

export type FilterParamValue = string | string[] | undefined;
export type FilterParams = Record<string, FilterParamValue>;

export type FilterOption = { value: string; label: string };

export const FILTER_PARAM_KEYS = [
  "period",
  "month",
  "stakeholderId",
  "branchId",
  "subTheme",
  "mainTheme",
  "source",
  "type",
  "status",
  "sort",
  "page",
  "q",
  "view",
  "attribution",
  "decidedBy",
  "orgType",
  "platform",
  "from",
  "to",
] as const;

export type FilterParamKey = (typeof FILTER_PARAM_KEYS)[number];

const FILTER_KEY_SET: ReadonlySet<string> = new Set(FILTER_PARAM_KEYS);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function firstParam(
  params: FilterParams,
  key: string,
): string | undefined {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

export function isFilterParamKey(key: string): key is FilterParamKey {
  return FILTER_KEY_SET.has(key);
}

/** Reporting period accepts `YYYY-MM`; `ALL` means the full history. */
export function parseFilterPeriod(
  params: FilterParams,
  fallback = "ALL",
): string {
  const raw = firstParam(params, "period") ?? firstParam(params, "month");
  if (!raw) return fallback;
  if (raw.toUpperCase() === "ALL") return "ALL";
  return MONTH_PATTERN.test(raw) ? raw : fallback;
}

export function parseFilterUuid(value: string | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export function parseFilterSubTheme(
  value: string | undefined,
): SubTheme | null {
  return isSubTheme(value) ? value : null;
}

export function parseFilterMainTheme(
  value: string | undefined,
): MainTheme | null {
  return isMainTheme(value) ? value : null;
}

export function parseFilterContentType(
  value: string | undefined,
): ContentType | null {
  return isContentType(value) ? value : null;
}

export function parseFilterSource(value: string | undefined): OrgSource | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return isOrgSource(upper) ? upper : null;
}

export function parseFilterOrgType(
  value: string | undefined,
): OrgTypeFilter | null {
  return parseOrgType(value);
}

export function parseFilterPlatform(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return isPlatform(upper) ? upper : null;
}

/** Accepts `YYYY-MM-DD`; returns null for invalid or empty input. */
export function parseFilterDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}

export function parseFilterStatus(
  value: string | undefined,
  fallback: ContentStatus | "ALL" = "ALL",
): ContentStatus | "ALL" {
  if (!value) return fallback;
  const upper = value.trim().toUpperCase();
  return (CONTENT_STATUSES as readonly string[]).includes(upper)
    ? (upper as ContentStatus)
    : fallback;
}

export function parseFilterSort<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;
  const lower = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(lower)
    ? (lower as T)
    : fallback;
}

export function parseFilterPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function parseFilterSearch(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 80);
}

/**
 * Builds a shareable URL while keeping every active filter. `page` is dropped
 * by default so changing a filter returns to the first page; pass
 * `keepPage: true` when navigating pagination.
 */
export function buildFilterHref(
  basePath: string,
  params: FilterParams,
  overrides: Record<string, string | number | null | undefined> = {},
  options: { hash?: string; keepPage?: boolean } = {},
): string {
  const merged = new Map<string, string | string[] | null>();
  for (const key of FILTER_PARAM_KEYS) {
    const value = params[key];
    if (value !== undefined) merged.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    merged.set(
      key,
      value === undefined
        ? null
        : typeof value === "number"
          ? String(value)
          : value,
    );
  }

  const search = new URLSearchParams();
  for (const key of FILTER_PARAM_KEYS) {
    if (key === "page" && !options.keepPage && !("page" in overrides)) {
      continue;
    }
    const value = merged.get(key);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const trimmed = item.trim();
        if (trimmed && trimmed !== "ALL") search.append(key, trimmed);
      }
      continue;
    }
    const trimmed = value.trim();
    if (trimmed && trimmed !== "ALL") search.set(key, trimmed);
  }

  if (search.get("page") === "1") search.delete("page");

  const query = search.toString();
  const hash = options.hash ? `#${options.hash}` : "";
  return `${basePath}${query ? `?${query}` : ""}${hash}`;
}

export function filterResetHref(basePath: string, hash?: string): string {
  return `${basePath}${hash ? `#${hash}` : ""}`;
}
