import { redirectToAnchor } from "@/lib/filters/redirect";

export default async function BranchAnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectToAnchor("/cabang/dashboard", params, "semua-konten");
}
