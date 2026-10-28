import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandingSnapshot } from "@/components/dashboard/standing-snapshot";
import { BestPostCard } from "@/components/dashboard/best-post-card";
import { AllTimeStandings } from "@/components/dashboard/all-time-standings";
import {
  fetchAllPostsForEmployee,
  fetchAllTimeStandings,
  fetchLeaderboard,
  type PostRowWithReportMonth,
} from "@/lib/monthly-stats";
import {
  getAppToday,
  getCurrentTrackingPeriod,
  getPreviousTrackingPeriod,
  isPeriodLocked,
  toIsoDate,
} from "@/lib/period";

/**
 * Career view for members: where they stand this month and all-time, their
 * best post, and the full all-time board. Split out of the dashboard so the
 * dashboard stays focused on the current month.
 */
export default async function StandingsPage() {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  // Admins see the all-time board on their own dashboard.
  if (me.role === "admin") redirect("/dashboard");

  const period = getCurrentTrackingPeriod();
  const previous = getPreviousTrackingPeriod();

  let allTime: Awaited<ReturnType<typeof fetchAllTimeStandings>> = [];
  let live: Awaited<ReturnType<typeof fetchLeaderboard>> = [];
  let allPosts: Awaited<ReturnType<typeof fetchAllPostsForEmployee>> = [];
  let fetchError: string | null = null;
  try {
    [allTime, live, allPosts] = await Promise.all([
      fetchAllTimeStandings(toIsoDate(previous.reportMonth)),
      fetchLeaderboard(period),
      fetchAllPostsForEmployee(me.id),
    ]);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load standings.";
  }

  const accepted = allPosts.filter((p) => p.validation_status === "accepted");
  const reach = accepted.reduce((s, p) => s + p.reach, 0);
  const impressions = accepted.reduce((s, p) => s + p.impressions, 0);
  const bestPost = accepted.reduce<PostRowWithReportMonth | null>(
    (best, p) => (best == null || p.reach > best.reach ? p : best),
    null,
  );
  const liveMe = live.find((r) => r.employeeId === me.id) ?? null;

  return (
    <div className="max-w-screen-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All-time standings</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Every post ever filed, ranked by Performance Score. Arrows show places moved since{" "}
          {previous.label} began.
        </p>
      </div>

      {fetchError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load standings</div>
          <div className="text-muted-foreground mt-1">{fetchError}</div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7 [&>*]:h-full">
          <StandingSnapshot
            periodLabel={period.label}
            periodStart={period.start}
            uploadDeadline={period.uploadDeadline}
            today={getAppToday()}
            locked={isPeriodLocked(period)}
            monthRank={liveMe?.rank ?? 0}
            monthParticipants={live.filter((r) => r.postCount > 0).length}
            allTime={allTime.find((s) => s.employeeId === me.id) ?? null}
            totals={{
              posts: accepted.length,
              reach,
              impressions,
              avgReach: accepted.length > 0 ? Math.round(reach / accepted.length) : 0,
            }}
          />
        </div>
        <div className="min-w-0 lg:col-span-5 [&>*]:h-full">
          {bestPost ? (
            <BestPostCard post={bestPost} />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Your best post
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your highest-reach post will show here once you upload one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AllTimeStandings
        standings={allTime}
        highlightEmployeeId={me.id}
        linkNames={false}
        sinceLabel={previous.label}
        showAll
      />
    </div>
  );
}
