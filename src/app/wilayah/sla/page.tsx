import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "SLA" };

export default function RegionalSlaAliasPage() {
  redirect("/wilayah");
}
