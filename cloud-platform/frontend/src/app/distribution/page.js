import { redirect } from "next/navigation";

export default function DistributionPage() {
  redirect("/resources?view=distribution");
}
