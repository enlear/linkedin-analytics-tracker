import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { LeaderboardChartCard } from "@/components/dashboard/leaderboard-chart-card";
import { type LeaderboardPoint } from "@/components/dashboard/leaderboard-chart";
import { WinnerCard } from "@/components/dashboard/winner-card";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { AllTimeStandings } from "@/components/dashboard/all-time-standings";
import { TopPostsCard } from "@/components/dashboard/top-posts-card";
import {
  fetchAcceptedPostsForPeriod,
  fetchLeaderboard,
  fetchAllTimeStandings,
  fetchRecentActivity,
  fetchWinnerForReportMonth,
} from "@/lib/monthly-stats";
import {
  getCurrentTrackingPeriod,
  getPreviousTrackingPeriod,
  isPeriodLocked,
  toIsoDate,
} from "@/lib/period";

export async function AdminDashboard({ employeeId }: { employeeId?: string }) {
  const current = getCurrentTrackingPeriod();
  const previous = getPreviousTrackingPeriod();
  // Once the cutoff passes the ranking below is frozen — say so rather than
  // showing a date that looks like a hard deadline it never was.
  const currentLocked = isPeriodLocked(current);

  // Defensive fetch: if the database is unreachable (a paused free project, or
  // a migration not yet run) any one of these throwing would crash the whole
  // route into a generic "server-side exception" page. Render the dashboard in
  // its empty state with a banner instead.
  let posts: Awaited<ReturnType<typeof fetchAcceptedPostsForPeriod>> = [];
  let leaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> = [];
  let lastLeaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> = [];
  let lastWinner: Awaited<ReturnType<typeof fetchWinnerForReportMonth>> = {
    winner: null,
    podium: [],
    period: previous,
  };
  let activity: Awaited<ReturnType<typeof fetchRecentActivity>> = [];
  let allTime: Awaited<ReturnType<typeof fetchAllTimeStandings>> = [];
  let fetchError: string | null = null;
  try {
    [posts, leaderboard, lastWinner, lastLeaderboard, activity, allTime] = await Promise.all([
      fetchAcceptedPostsForPeriod(current),
      fetchLeaderboard(current),
      fetchWinnerForReportMonth(
        previous.reportMonth.getUTCFullYear(),
        previous.reportMonth.getUTCMonth(),
      ),
      fetchLeaderboard(previous),
      fetchRecentActivity(50),
      fetchAllTimeStandings(toIsoDate(previous.reportMonth)),
    ]);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load dashboard data.";
  }

  const totalUploads = posts.length;
  const uniqueUploaders = new Set(posts.map((p) => p.employee_id)).size;
  const notUploaded = leaderboard.filter((s) => s.postCount === 0).length;
  const totalReach = posts.reduce((sum, p) => sum + p.reach, 0);

  const topPosts = [...posts].sort((a, b) => b.reach - a.reach);

  const reachChartData: LeaderboardPoint[] = leaderboard
    .filter((s) => s.postCount > 0)
    .map((s) => ({
      name: s.employee.name ?? s.employee.email,
      avgReach: Math.round(s.avgReach),
      avgImpressions: Math.round(s.avgImpressions),
      postCount: s.postCount,
    }));

  const authors = new Map(leaderboard.map((s) => [s.employeeId, s.employee]));

  return (
    <div className="max-w-screen-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monthly LinkedIn performance</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {current.label} — {current.rangeLabel}.{" "}
            {currentLocked ? (
              <>
                Ranking closed {format(current.uploadDeadline, "MMM d, yyyy")}; later uploads are
                tracked but not ranked.
              </>
            ) : (
              <>Upload by {format(current.uploadDeadline, "MMM d, yyyy")} to count for the winner.</>
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/reports?month=${toIsoDate(current.reportMonth)}`}>
            View monthly report
          </Link>
        </Button>
      </div>

      {fetchError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load dashboard data</div>
          <div className="text-muted-foreground mt-1">{fetchError}</div>
        </div>
      ) : null}

      <WinnerCard
        winner={lastWinner.winner}
        podium={lastWinner.podium}
        periodLabel={lastWinner.period.label}
        rangeLabel={lastWinner.period.rangeLabel}
        title={`Last month's winner - ${lastWinner.period.label}`}
        leaderboard={lastLeaderboard}
      />

      <p className="text-xs text-muted-foreground -mt-4">
        Winners are ranked by Performance Score.{" "}
        <Link href="/docs/performance-score" className="underline hover:text-foreground">
          How is this calculated?
        </Link>
      </p>

      <AllTimeStandings
        standings={allTime}
        highlightEmployeeId={employeeId}
        sinceLabel={previous.label}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Uploads this month" value={totalUploads} />
        <StatCard label="Active employees" value={uniqueUploaders} />
        <StatCard label="Yet to upload" value={notUploaded} />
        <StatCard label="Total reach" value={totalReach} />
      </div>

      <LeaderboardChartCard
        title={`Leaderboard — ${current.label}`}
        data={reachChartData}
        initialCount={5}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingTable
          title="Full ranking"
          rows={leaderboard}
          initialCount={8}
          variant="compact"
        />
        <ActivityPanel items={activity} initialCount={6} />
      </div>

      <TopPostsCard
        title={`Top posts — ${current.label}`}
        posts={topPosts}
        authors={authors}
        initialCount={5}
      />
    </div>
  );
}
