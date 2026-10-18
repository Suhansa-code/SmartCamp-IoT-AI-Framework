import { redirect } from "next/navigation";

export default function StockPage() {
  redirect("/resources?view=stock");
}
