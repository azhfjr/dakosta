import { redirect } from "next/navigation";

export default function BranchMapRedirect() {
  redirect("/cabang/dashboard?view=peta");
}
