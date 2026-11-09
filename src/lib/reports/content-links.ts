import "server-only";

import type { AppRole } from "@/lib/authz/types";
import { getAppUrl } from "@/lib/env";

const DETAIL_BASE: Record<AppRole, string> = {
  MASTER_ADMIN: "/admin/konten",
  REGIONAL_ADMIN: "/wilayah/konten",
  BRANCH_ADMIN: "/cabang/konten",
  STAKEHOLDER: "/client/konten",
};

/**
 * Export links must open from outside the app, so relative values are resolved
 * against the deployment URL and only http(s) or root-relative URLs are kept.
 */
export function absoluteContentUrl(input: {
  role: AppRole;
  id: string;
  publishedUrl?: string | null;
}): string {
  const appUrl = getAppUrl().replace(/\/+$/, "");
  const published = input.publishedUrl?.trim();
  if (published) {
    if (/^https?:\/\//i.test(published)) return published;
    if (published.startsWith("/")) return `${appUrl}${published}`;
  }
  return `${appUrl}${DETAIL_BASE[input.role]}/${input.id}`;
}
