import { redirect } from "next/navigation";

export default function RegionalContentRedirect() {
  redirect("/wilayah/dashboard?view=konten");
}
