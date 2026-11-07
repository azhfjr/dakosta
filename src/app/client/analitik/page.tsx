import { redirectWithFilters } from "@/lib/filters/redirect";

export default async function ClientAnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectWithFilters("/client/konten", params);
}
