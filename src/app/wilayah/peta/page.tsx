import { redirectToAnchor } from "@/lib/filters/redirect";

export default async function RegionalMapRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectToAnchor("/wilayah/dashboard", params, "peta");
}
