import { redirectWithFilters } from "@/lib/filters/redirect";

export default async function RegionalAnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectWithFilters("/wilayah", params);
}
