import Link from "next/link";
import { format } from "date-fns";
import { BarChart3, Eye, FileText, TrendingUp, Upload, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { LiveGlanceRow } from "@/components/dashboard/live-glance-row";
import { MonthGlance } from "@/components/dashboard/month-glance";
import { WinnerCard } from "@/components/dashboard/winner-card";
import { EmployeeUploadsTable } from "@/components/dashboard/employee-uploads-table";
import { EmployeeHistoryChartLazy } from "@/components/dashboard/employee-history-chart-lazy";
import { WeeklyActivityChartLazy } from "@/components/dashboard/weekly-activity-chart-lazy";
import type { EmployeeHistoryPoint } from "@/components/dashboard/employee-history-chart";
import type { WeeklyActivityPoint } from "@/components/dashboard/weekly-activity-chart";
import {
  fetchAcceptedPostsForPeriod,
  fetchAllPostsForEmployee,
  fetchLeaderboard,
  fetchPostsForEmployeeInPeriod,
  fetchWinnerForReportMonth,
  type PostRow,
  type PostRowWithReportMonth,
} from "@/lib/monthly-stats";
import {
  getCurrentTrackingPeriod,
  getPreviousTrackingPeriod,
  isPeriodLocked,
  type TrackingPeriod,
} from "@/lib/period";

const HISTORY_MONTHS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildHistory(posts: PostRowWithReportMonth[]): EmployeeHistoryPoint[] {
  // Bucket accepted posts by reportMonth ("YYYY-MM-DD" first-of-month).
  const buckets = new Map<
    string,
    { reach: number; impressions: number; postCount: number }
  >();
  for (const p of posts) {
    if (p.validation_status !== "accepted") continue;
    if (!p.report_month) continue;
    const bucket = buckets.get(p.report_month) ?? {
      reach: 0,
      impressions: 0,
      postCount: 0,
    };
    bucket.reach += p.reach;
    bucket.impressions += p.impressions;
    bucket.postCount += 1;
    buckets.set(p.report_month, bucket);
  }
  // Pad the trailing N months so the chart isn't sparse for newer employees.
  const now = new Date();
  const months: EmployeeHistoryPoint[] = [];
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const bucket = buckets.get(iso) ?? { reach: 0, impressions: 0, postCount: 0 };
    months.push({
      month: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      reach: bucket.reach,
      impressions: bucket.impressions,
      postCount: bucket.postCount,
    });
  }
  return months;
}

/**
 * Posts published per 7-day slice of the tracking window, split into the
 * viewer's own posts and everyone else's.
 */
function buildWeeklyActivity(
  teamPosts: PostRow[],
  period: TrackingPeriod,
  employeeId: string,
): WeeklyActivityPoint[] {
  const start = period.start.getTime();
  const days = Math.round((period.end.getTime() - start) / DAY_MS) + 1;
  const weeks = Math.ceil(days / 7);
  const points: WeeklyActivityPoint[] = Array.from({ length: weeks }, (_, i) => ({
    week: new Date(start + i * 7 * DAY_MS).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    you: 0,
    others: 0,
  }));
  for (const p of teamPosts) {
    const t = new Date(p.post_date + "T00:00:00Z").getTime();
    const idx = Math.floor((t - start) / (7 * DAY_MS));
    if (idx < 0 || idx >= weeks) continue;
    if (p.employee_id === employeeId) points[idx].you += 1;
    else points[idx].others += 1;
  }
  return points;
}

export async function EmployeeDashboard({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string | null;
}) {
  const period = getCurrentTrackingPeriod();
  // After the cutoff the ranking is settled; uploads still land here for the
  // employee's own progress tracking.
  const periodLocked = isPeriodLocked(period);
  const previous = getPreviousTrackingPeriod();

  // Defensive fetches — see admin-dashboard for the same rationale. Any single
  // failure shouldn't crash the whole route.
  let posts: Awaited<ReturnType<typeof fetchPostsForEmployeeInPeriod>> = [];
  let allPosts: Awaited<ReturnType<typeof fetchAllPostsForEmployee>> = [];
  let lastWinner: Awaited<ReturnType<typeof fetchWinnerForReportMonth>> = {
    winner: null,
    podium: [],
    period: previous,
  };
  let lastLeaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> = [];
  let liveLeaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> = [];
  let teamPosts: Awaited<ReturnType<typeof fetchAcceptedPostsForPeriod>> = [];
  let fetchError: string | null = null;
  try {
    [posts, allPosts, lastWinner, lastLeaderboard, liveLeaderboard, teamPosts] =
      await Promise.all([
        fetchPostsForEmployeeInPeriod(employeeId, period),
        fetchAllPostsForEmployee(employeeId),
        fetchWinnerForReportMonth(
          previous.reportMonth.getUTCFullYear(),
          previous.reportMonth.getUTCMonth(),
        ),
        fetchLeaderboard(previous),
        fetchLeaderboard(period),
        fetchAcceptedPostsForPeriod(period),
      ]);
    posts = posts.sort((a, b) => (a.post_date < b.post_date ? 1 : -1));
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load your dashboard.";
  }
  const accepted = posts.filter((p) => p.validation_status === "accepted");

  // The viewer's own line on each monthly board.
  const liveMe = liveLeaderboard.find((r) => r.employeeId === employeeId) ?? null;
  const lastMe = lastLeaderboard.find((r) => r.employeeId === employeeId) ?? null;

  // This month (every accepted post in the window, late ones included — this
  // is the viewer's progress view, not the ranking).
  const monthPosts = accepted.length;
  const monthReach = accepted.reduce((s, p) => s + p.reach, 0);
  const monthImpressions = accepted.reduce((s, p) => s + p.impressions, 0);
  const monthAvgReach = monthPosts > 0 ? Math.round(monthReach / monthPosts) : 0;
  const prevShort = previous.reportMonth.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });

  const history = buildHistory(allPosts);
  const hasAnyHistory = history.some((m) => m.postCount > 0);
  const weekly = buildWeeklyActivity(teamPosts, period, employeeId);

  const errorBanner = fetchError ? (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <div className="font-medium">Couldn&apos;t load your dashboard</div>
      <div className="text-muted-foreground mt-1">{fetchError}</div>
    </div>
  ) : null;

  const boardProps = {
    rows: liveLeaderboard,
    periodLabel: period.label,
    rangeLabel: period.rangeLabel,
    highlightEmployeeId: employeeId,
    linkNames: false,
    locked: periodLocked,
  };

  const lastMonth = (
    <WinnerCard
      winner={lastWinner.winner}
      podium={lastWinner.podium}
      periodLabel={lastWinner.period.label}
      rangeLabel={lastWinner.period.rangeLabel}
      title={`Last month's winner - ${lastWinner.period.label}`}
      leaderboard={lastLeaderboard}
      highlightEmployeeId={employeeId}
      linkNames={false}
    />
  );

  // Empty-state ONLY if there's nothing in the current period AND no history.
  // A returning employee with no posts THIS month but history from past months
  // should still see their charts.
  if (accepted.length === 0 && posts.length === 0 && !hasAnyHistory) {
    return (
      <div className="max-w-screen-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome{employeeName ? `, ${employeeName.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Tracking period {period.label} — {period.rangeLabel}. Upload by{" "}
            {format(period.uploadDeadline, "MMM d, yyyy")}; winner announced{" "}
            {format(period.winnerDate, "MMM d, yyyy")}.
          </p>
        </div>

        {errorBanner}

        <LiveGlanceRow board={boardProps}>
          <Card>
            <CardContent className="pt-6 h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">No posts uploaded yet for {period.label}</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Upload LinkedIn analytics for posts published between {period.rangeLabel}.
                </p>
              </div>
              <Button asChild>
                <Link href="/upload">Upload your first post</Link>
              </Button>
            </CardContent>
          </Card>
        </LiveGlanceRow>

        {lastMonth}
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your {period.label} performance</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Tracking period {period.rangeLabel}.{" "}
            {periodLocked
              ? "Ranking is closed — new uploads still track your progress."
              : `Upload by ${format(period.uploadDeadline, "MMM d, yyyy")} to count for the winner.`}{" "}
            Winner announced {format(period.winnerDate, "MMM d, yyyy")}.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/upload">
            <Upload className="w-4 h-4" />
            Upload another post
          </Link>
        </Button>
      </div>

      {errorBanner}

      {/* Live board + my month at a glance. */}
      <LiveGlanceRow board={boardProps}>
        <MonthGlance me={liveMe} rows={liveLeaderboard} />
      </LiveGlanceRow>

      {/* This month in numbers, against last month. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiTile
          label="Posts this month"
          value={monthPosts}
          previous={lastMe?.postCount ?? 0}
          previousLabel={prevShort}
          icon={FileText}
        />
        <KpiTile
          label="Reach"
          value={monthReach}
          previous={lastMe?.totalReach ?? 0}
          previousLabel={prevShort}
          icon={Users}
        />
        <KpiTile
          label="Impressions"
          value={monthImpressions}
          previous={lastMe?.totalImpressions ?? 0}
          previousLabel={prevShort}
          icon={Eye}
        />
        <KpiTile
          label="Avg reach / post"
          value={monthAvgReach}
          previous={lastMe ? Math.round(lastMe.avgReach) : 0}
          previousLabel={prevShort}
          icon={BarChart3}
        />
      </div>

      {/* Trends: six-month history beside this period's weekly rhythm. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Your last {HISTORY_MONTHS} months
            </CardTitle>
            <CardDescription className="text-xs">
              Reach and impressions per month, with posts on the right axis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeHistoryChartLazy data={history} height={230} />
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Posting activity this period
            </CardTitle>
            <CardDescription className="text-xs">
              Posts published each week — you vs the rest of the team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyActivityChartLazy data={weekly} height={230} />
          </CardContent>
        </Card>
      </div>

      {lastMonth}

      <EmployeeUploadsTable
        title={`Your uploads — ${period.label}`}
        posts={posts}
        initialCount={10}
        allowDelete
      />

      {allPosts.length > posts.length ? (
        <EmployeeUploadsTable
          title="All your uploads"
          posts={allPosts}
          initialCount={10}
          showUploadedAt
          allowDelete
        />
      ) : null}
    </div>
  );
}
