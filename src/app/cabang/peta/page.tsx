import { redirectToAnchor } from "@/lib/filters/redirect";

export default async function BranchMapRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectToAnchor("/cabang/dashboard", params, "peta");
}
