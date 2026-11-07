import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Kinerja" };

export default function AdminPerformanceAliasPage() {
  redirect("/admin/laporan");
}
