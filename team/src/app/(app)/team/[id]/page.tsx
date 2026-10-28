import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { fetchAllPostsForEmployee, fetchEmployeeById } from "@/lib/monthly-stats";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmployeeUploadsTable } from "@/components/dashboard/employee-uploads-table";
import { getCurrentTrackingPeriod, toIsoDate } from "@/lib/period";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const employee = await fetchEmployeeById(id);
  if (!employee) notFound();

  const period = getCurrentTrackingPeriod();
  const posts = await fetchAllPostsForEmployee(id);
  const currentPosts = posts.filter(
    (p) => p.report_month === toIsoDate(period.reportMonth) && p.validation_status === "accepted",
  );

  const totalReach = currentPosts.reduce((s, p) => s + p.reach, 0);
  const totalImpressions = currentPosts.reduce((s, p) => s + p.impressions, 0);
  const avgReach = currentPosts.length > 0 ? Math.round(totalReach / currentPosts.length) : 0;
  const avgImpressions =
    currentPosts.length > 0 ? Math.round(totalImpressions / currentPosts.length) : 0;

  return (
    <div className="max-w-7xl space-y-8">
      <div className="space-y-3">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to employee list
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{employee.name ?? employee.email}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {employee.email}
            {employee.created_at
              ? ` · joined ${format(new Date(employee.created_at), "MMM d, yyyy")}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label={`Posts in ${period.label}`} value={currentPosts.length} />
        <StatCard label="Total reach" value={totalReach} />
        <StatCard label="Total impressions" value={totalImpressions} />
        <StatCard label="Avg reach / post" value={avgReach} />
        <StatCard label="Avg impressions / post" value={avgImpressions} />
      </div>

      <EmployeeUploadsTable
        title="All uploaded posts"
        posts={posts}
        initialCount={15}
        showUploadedAt
        allowDelete
        adminDelete
      />
    </div>
  );
}
