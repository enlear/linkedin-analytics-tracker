import { UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { Movement } from "./leaderboard-parts";
import type { AllTimeStanding } from "@/lib/monthly-stats";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  periodLabel: string;
  /** First day of the tracking window (UTC midnight). */
  periodStart: Date;
  /** Last day uploads are advised (UTC midnight). */
  uploadDeadline: Date;
  /** "Today" in the app timezone (UTC midnight) — passed in to keep this pure. */
  today: Date;
  locked: boolean;
  /** Current-month rank (0 = not ranked yet) and how many are ranked. */
  monthRank: number;
  monthParticipants: number;
  allTime: AllTimeStanding | null;
  totals: { posts: number; reach: number; impressions: number; avgReach: number };
}

/** Sidebar summary: where the period is, where I stand, and my career totals. */
export function StandingSnapshot({
  periodLabel,
  periodStart,
  uploadDeadline,
  today,
  locked,
  monthRank,
  monthParticipants,
  allTime,
  totals,
}: Props) {
  const totalDays = Math.round((uploadDeadline.getTime() - periodStart.getTime()) / DAY_MS) + 1;
  const elapsed = Math.min(
    totalDays,
    Math.max(0, Math.round((today.getTime() - periodStart.getTime()) / DAY_MS) + 1),
  );
  const daysLeft = Math.round((uploadDeadline.getTime() - today.getTime()) / DAY_MS);
  const progress = locked ? 1 : totalDays > 0 ? elapsed / totalDays : 0;

  const status = locked
    ? "Ranking closed"
    : daysLeft <= 0
      ? "Last day to upload"
      : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left to upload`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserRound className="w-4 h-4 text-muted-foreground" />
          Your standing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Period progress */}
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium">{periodLabel}</span>
            <span
              className={cn(
                "tabular-nums",
                !locked && daysLeft <= 3 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground",
              )}
            >
              {status}
            </span>
          </div>
          <div
            className="mt-2 h-2 rounded-full bg-muted overflow-hidden"
            title={`Day ${elapsed} of ${totalDays}`}
          >
            <div
              className={cn("h-full rounded-full", locked ? "bg-muted-foreground/60" : "bg-primary")}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Ranks */}
        <div className="grid grid-cols-2 gap-3">
          <RankBlock
            label="This month"
            rank={monthRank}
            of={monthParticipants}
            empty="Not ranked yet"
          />
          <RankBlock
            label="All-time"
            rank={allTime?.rank ?? 0}
            of={null}
            empty="No posts yet"
            movement={
              allTime && allTime.rank > 0 ? (
                <Movement rank={allTime.rank} previousRank={allTime.previousRank} />
              ) : null
            }
          />
        </div>

        {/* Career totals */}
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            All-time totals
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Posts" value={totals.posts} />
            <Mini label="Reach" value={totals.reach} />
            <Mini label="Impressions" value={totals.impressions} />
            <Mini label="Avg reach" value={totals.avgReach} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankBlock({
  label,
  rank,
  of,
  empty,
  movement,
}: {
  label: string;
  rank: number;
  of: number | null;
  empty: string;
  movement?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {rank > 0 ? (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums leading-none">#{rank}</span>
          {of ? <span className="text-xs text-muted-foreground">of {of}</span> : null}
          {movement}
        </div>
      ) : (
        <div className="mt-1.5 text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{formatNumber(value)}</div>
    </div>
  );
}
