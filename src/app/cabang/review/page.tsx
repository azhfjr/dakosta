import { redirect } from "next/navigation";

export default async function BranchReviewRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["status", "q", "page"] as const) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  const serialized = query.toString();
  redirect(`/cabang${serialized ? `?${serialized}` : ""}`);
}
