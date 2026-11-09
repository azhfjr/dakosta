import { redirectToAnchor } from "@/lib/filters/redirect";
import type { FilterParams } from "@/lib/filters/query";
import {
  dashboardViewAnchor,
  type DashboardVariant,
} from "@/lib/dashboard/variant";

export { dashboardViewAnchor } from "@/lib/dashboard/variant";

/** `?view=` deep links land on the matching section of the role's dashboard. */
export function redirectDashboardView(
  basePath: string,
  params: FilterParams,
  variant: DashboardVariant,
): void {
  const anchor = dashboardViewAnchor(params, variant);
  if (anchor) redirectToAnchor(basePath, params, anchor);
}
