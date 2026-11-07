import { redirectWithFilters } from "@/lib/filters/redirect";

export default async function BranchAnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectWithFilters("/cabang", params);
}
