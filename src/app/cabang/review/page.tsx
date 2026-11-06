import { redirect } from "next/navigation";

import { buildFilterHref } from "@/lib/filters/query";

export default async function BranchReviewRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(buildFilterHref("/cabang", params, {}, { keepPage: true }));
}
