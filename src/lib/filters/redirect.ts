import { redirect } from "next/navigation";

import { buildFilterHref, type FilterParams } from "./query";

/**
 * In-app legacy route redirect: keeps every known filter parameter so a shared
 * link still opens the same slice, without a section anchor.
 */
export function redirectWithFilters(path: string, params: FilterParams): never {
  const rest = { ...params };
  delete rest.view;
  redirect(buildFilterHref(path, rest, {}, { keepPage: true }));
}

/**
 * In-app legacy route redirect: keeps every known filter parameter so a shared
 * link still opens the same slice, then lands on the dashboard section anchor.
 */
export function redirectToAnchor(
  path: string,
  params: FilterParams,
  hash: string,
): never {
  const rest = { ...params };
  delete rest.view;
  redirect(buildFilterHref(path, rest, {}, { hash, keepPage: true }));
}
