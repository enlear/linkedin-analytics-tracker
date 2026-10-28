import { redirect } from "next/navigation";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { AdminDashboard } from "./admin-dashboard";
import { EmployeeDashboard } from "./employee-dashboard";

export default async function DashboardPage() {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) redirect("/login");

  if (employee.role === "admin") {
    return <AdminDashboard employeeId={employee.id} />;
  }
  return <EmployeeDashboard employeeId={employee.id} employeeName={employee.name} />;
}
