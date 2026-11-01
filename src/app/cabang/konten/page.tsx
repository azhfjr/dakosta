import { redirect } from "next/navigation";

export default function BranchContentRedirect() {
  redirect("/cabang/dashboard?view=konten");
}
