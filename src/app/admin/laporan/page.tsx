import { redirectToAnchor } from "@/lib/filters/redirect";

export default async function AdminReportRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirectToAnchor("/admin", params, "konten-disetujui");
}
