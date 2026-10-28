import { redirect } from "next/navigation";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";

export default async function Home() {
  const employee = await getOrBootstrapCurrentEmployee();
  redirect(employee ? "/dashboard" : "/login");
}
