import { redirect } from "next/navigation";

export default function RegionalMapRedirect() {
  redirect("/wilayah/dashboard?view=peta");
}
