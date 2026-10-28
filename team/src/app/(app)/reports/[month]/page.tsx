import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Trophy } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import {
  fetchAcceptedPostsForPeriod,
  fetchLeaderboard,
  fetchWinnerForReportMonth,
} from "@/lib/monthly-stats";
import { buildPeriod, isPeriodLocked } from "@/lib/period";
import { formatNumber } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { siteConfig } from "@/site.config";

export default async function MonthlyReport({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const { month } = await params;
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) notFound();
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) notFound();

  const period = buildPeriod(year, monthIndex);
  const locked = isPeriodLocked(period);
  const [leaderboard, posts, winnerInfo] = await Promise.all([
    fetchLeaderboard(period),
    fetchAcceptedPostsForPeriod(period),
    fetchWinnerForReportMonth(year, monthIndex),
  ]);

  const totalReach = posts.reduce((s, p) => s + p.reach, 0);
  const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
  const lateTotal = leaderboard.reduce((s, r) => s + r.lateCount, 0);
  const employeeNames = new Map(leaderboard.map((s) => [s.employeeId, s.employee]));

  return (
    <div className="max-w-4xl space-y-6 print:space-y-4 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All reports
        </Link>
        <PrintButton />
      </div>

      <div className="report-page space-y-6 print:space-y-3">
        <header className="space-y-2 border-b border-border pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {siteConfig.name} — Monthly Report
          </div>
          <h1 className="text-3xl font-semibold">{period.label}</h1>
          <div className="text-sm text-muted-foreground">
            Tracking period: {period.rangeLabel} · Upload by:{" "}
            {format(period.uploadDeadline, "MMM d, yyyy")} · Winner date:{" "}
            {format(period.winnerDate, "MMM d, yyyy")}
            {locked ? " · Ranking closed" : " · Ranking open"}
          </div>
          {lateTotal > 0 ? (
            <div className="text-xs text-muted-foreground">
              {lateTotal} {lateTotal === 1 ? "post was" : "posts were"} uploaded after the cutoff
              and {lateTotal === 1 ? "is" : "are"} excluded from the ranking below.
            </div>
          ) : null}
        </header>

        <section className="rounded-lg border border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5 p-5 print:bg-transparent">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <Trophy className="w-4 h-4" /> Winner
          </div>
          {winnerInfo.winner ? (
            <>
              <div className="text-xl font-semibold mt-2">
                {winnerInfo.winner.employee.name ?? winnerInfo.winner.employee.email}
              </div>
              <div className="text-sm text-muted-foreground">
                {winnerInfo.winner.employee.email}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                <ReportStat
                  label="Avg reach / post"
                  value={formatNumber(Math.round(winnerInfo.winner.avgReach))}
                />
                <ReportStat
                  label="Avg impressions / post"
                  value={formatNumber(Math.round(winnerInfo.winner.avgImpressions))}
                />
                <ReportStat label="Valid posts" value={String(winnerInfo.winner.postCount)} />
                <ReportStat
                  label="Total reach"
                  value={formatNumber(winnerInfo.winner.totalReach)}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mt-2">
              No winner — no valid posts uploaded for this period.
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <ReportStat label="Total uploads" value={String(posts.length)} />
          <ReportStat
            label="Active employees"
            value={String(new Set(posts.map((p) => p.employee_id)).size)}
          />
          <ReportStat label="Total reach" value={formatNumber(totalReach)} />
          <ReportStat label="Total impressions" value={formatNumber(totalImpressions)} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Leaderboard</h2>
          <table className="w-full text-sm border border-border rounded-md overflow-hidden">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Employee</th>
                <th className="text-right px-3 py-2">Posts</th>
                <th className="text-right px-3 py-2">Avg reach</th>
                <th className="text-right px-3 py-2">Avg impr.</th>
                <th className="text-right px-3 py-2">Total reach</th>
                <th className="text-right px-3 py-2">Total impr.</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((s) => (
                <tr key={s.employeeId} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.rank > 0 ? s.rank : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.employee.name ?? s.employee.email}</div>
                    <div className="text-xs text-muted-foreground">{s.employee.email}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{s.postCount}</td>
                  <td className="px-3 py-2 text-right">
                    {s.postCount > 0 ? formatNumber(Math.round(s.avgReach)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.postCount > 0 ? formatNumber(Math.round(s.avgImpressions)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.postCount > 0 ? formatNumber(s.totalReach) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.postCount > 0 ? formatNumber(s.totalImpressions) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Individual posts</h2>
          {posts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No posts were uploaded for this period.
            </div>
          ) : (
            <table className="w-full text-sm border border-border rounded-md overflow-hidden">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Employee</th>
                  <th className="text-left px-3 py-2">Post date</th>
                  <th className="text-left px-3 py-2">Post URL</th>
                  <th className="text-right px-3 py-2">Reach</th>
                  <th className="text-right px-3 py-2">Impr.</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const emp = employeeNames.get(p.employee_id);
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2">{emp?.name ?? emp?.email ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {format(new Date(p.post_date + "T00:00:00"), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2 text-xs truncate max-w-[24rem]">
                        {p.post_url ?? p.file_name}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatNumber(p.reach)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(p.impressions)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer className="text-xs text-muted-foreground border-t border-border pt-3">
          Generated {format(new Date(), "MMM d, yyyy 'at' h:mm a")} · Ranking by avg reach per
          post; ties broken by avg impressions per post, then total reach.
        </footer>
      </div>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3 print:break-inside-avoid">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
    </div>
  );
}
