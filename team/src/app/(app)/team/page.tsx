import { redirect } from "next/navigation";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { fetchLeaderboard } from "@/lib/monthly-stats";
import { getCurrentTrackingPeriod } from "@/lib/period";

export default async function TeamPage() {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "admin") redirect("/dashboard");

  const period = getCurrentTrackingPeriod();
  const ranked = await fetchLeaderboard(period);

  return (
    <div className="max-w-screen-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Employee list</h1>
        <p className="text-muted-foreground mt-1">
          {period.label} performance. Click an employee to see their uploaded posts.
        </p>
      </div>

      <RankingTable
        title={`${ranked.length} ${ranked.length === 1 ? "employee" : "employees"}`}
        rows={ranked}
        initialCount={10}
        variant="full"
        enableDelete
        currentEmployeeId={employee.id}
      />
    </div>
  );
}
