"use client";

// Pieces shared by the monthly leaderboard (winner-card) and the all-time
// standings, so a rank, a score bar and a movement arrow look identical
// wherever they appear.

import { ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Gold / silver / bronze, one per podium place. Validated for mutual
 * separation and surface contrast rather than picked by eye: the worst
 * adjacent pair separates at ΔE 12.3 under protanopia and 17.5 at normal
 * vision, and every step clears 3:1 on both card surfaces. Silver reads
 * low-chroma on purpose — grey IS its identity — and never carries meaning
 * alone: the medal, the place label and the position all repeat it.
 */
export const RANK_STYLE = [
  {
    text: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-700 dark:bg-amber-400",
    ring: "ring-2 ring-amber-700/50 dark:ring-amber-400/50",
    card: "border-amber-600/50 bg-amber-500/10",
  },
  {
    text: "text-slate-600 dark:text-slate-400",
    bar: "bg-slate-600 dark:bg-slate-400",
    ring: "ring-2 ring-slate-600/50 dark:ring-slate-400/50",
    card: "border-slate-500/50 bg-slate-500/10",
  },
  {
    text: "text-orange-800 dark:text-orange-500",
    bar: "bg-orange-800 dark:bg-orange-500",
    ring: "ring-2 ring-orange-800/50 dark:ring-orange-500/50",
    card: "border-orange-700/50 bg-orange-700/10",
  },
] as const;

export const PLACE_LABEL = ["Winner", "1st runner-up", "2nd runner-up"] as const;
export const MEDAL = ["🥇", "🥈", "🥉"] as const;

/**
 * Score bar fill for everyone outside the top three. One hue across all of
 * them — the score is a single magnitude measure, so bar LENGTH carries the
 * value. amber-700 / amber-400 are the steps that clear 3:1 on the light and
 * dark card surfaces (the app's amber-500 manages only 1.9:1 on light).
 */
export const BAR_FILL = "bg-amber-700 dark:bg-amber-400";

/** Performance Score formatted to 2 dp (e.g. 0.49). */
export function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Performance Score meter. The score is already 0–1 (normalised against the
 * field), so the bar maps it directly — no rescaling that would make two
 * months' bars mean different things. The number is always printed alongside,
 * so the value never depends on reading a length.
 */
export function ScoreBar({
  score,
  fill = BAR_FILL,
  className,
}: {
  score: number;
  fill?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return (
    <div
      className={cn("h-1.5 rounded-full bg-muted overflow-hidden", className)}
      title={`Performance Score ${formatScore(score)} of 1.00`}
    >
      <div
        className={cn("h-full rounded-full", fill)}
        // A non-zero score always shows at least a sliver rather than nothing.
        style={{ width: pct > 0 ? `max(2px, ${pct}%)` : 0 }}
      />
    </div>
  );
}

/**
 * Places gained or lost in the all-time table over the last month — the
 * Billboard-chart convention. Green up / red down are status colours, so they
 * always ship with an arrow and a number: direction never rests on hue alone.
 *
 * `previousRank` is null for someone who had no all-time standing a month ago
 * (their first ever posts landed this month) — that is a genuine "new", not
 * the artefact of having skipped a single month.
 */
export function Movement({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  // Never posted at all — the row already says "no uploads"; a second marker
  // would just add noise to a line that is fully explained.
  if (rank <= 0) return null;

  if (previousRank == null) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1 py-0 leading-tight shrink-0"
        title="First time on the all-time board"
      >
        new
      </Badge>
    );
  }

  const delta = previousRank - rank;
  if (delta === 0) {
    return (
      <span className="text-xs text-muted-foreground shrink-0" title="No change over the last month">
        –<span className="sr-only">No change over the last month</span>
      </span>
    );
  }

  const up = delta > 0;
  const places = Math.abs(delta);
  const label = `${up ? "Up" : "Down"} ${places} ${places === 1 ? "place" : "places"} over the last month`;
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums shrink-0",
        up ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400",
      )}
      title={label}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {places}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "+2*" marker for posts uploaded after a month's cutoff. */
export function LateSuffix({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-1 text-xs text-muted-foreground"
      title={`${count} uploaded after the cutoff — tracked, not ranked`}
    >
      +{count}*
    </span>
  );
}
