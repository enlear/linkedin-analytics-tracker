"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  BAR_FILL,
  LateSuffix,
  MEDAL,
  PLACE_LABEL,
  RANK_STYLE,
  ScoreBar,
  formatScore,
} from "./leaderboard-parts";
import type { RankedEmployee } from "@/lib/monthly-stats";

interface WinnerCardProps {
  winner: RankedEmployee | null;
  // Top 3 ranked employees (winner + 1st runner-up + 2nd runner-up). Empty
  // slots are dropped — if only one person uploaded that month, only the
  // winner is rendered.
  podium?: RankedEmployee[];
  periodLabel: string;
  rangeLabel: string;
  variant?: "primary" | "muted";
  title?: string;
  // Full ranked list (ALL employees) for the same period. Everyone below the
  // podium is listed beside it, inside a fixed-height scroller.
  leaderboard?: RankedEmployee[];
  // Highlight this employee (the logged-in member) wherever they appear. The
  // scroller opens positioned on their row rather than repeating it.
  highlightEmployeeId?: string;
  // Whether names link to /team/{id} (admin-only route). Member views pass
  // false to avoid dead links.
  linkNames?: boolean;
}

function displayName(place: RankedEmployee): string {
  return place.employee.name ?? place.employee.email;
}

function initialsFor(place: RankedEmployee): string {
  return displayName(place).slice(0, 2).toUpperCase();
}

export function WinnerCard({
  winner,
  podium,
  periodLabel,
  rangeLabel,
  variant = "primary",
  title,
  leaderboard,
  highlightEmployeeId,
  linkNames = true,
}: WinnerCardProps) {
  // Prefer the explicit podium when supplied; otherwise fall back to the
  // single-winner prop for backwards-compat with older callers.
  const places: RankedEmployee[] = (podium && podium.length > 0
    ? podium
    : winner
      ? [winner]
      : []
  ).slice(0, 3);

  const placeIds = new Set(places.map((p) => p.employeeId));
  const rest = (leaderboard ?? []).filter((r) => !placeIds.has(r.employeeId));

  return (
    <Card className={variant === "primary" ? "border-amber-500/30 bg-amber-500/5" : undefined}>
      <CardContent className="pt-5 pb-6">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight truncate">{title ?? periodLabel}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">
                Employee social leaderboard
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums shrink-0 pt-1">
            {rangeLabel}
          </div>
        </header>

        {places.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            No winner for {periodLabel} — no valid posts were uploaded.
          </div>
        ) : (
          // When there are teammates beyond the podium, the podium and the list
          // sit side by side from lg up (card keeps a stable height). With no
          // list (a team of ≤3), the podium spans the full width on its own.
          <div
            className={cn(
              "mt-6 grid gap-5",
              rest.length > 0 &&
                "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-stretch",
            )}
          >
            <div className="grid grid-cols-3 gap-3 sm:gap-4 items-stretch h-full">
              {places.map((p, i) => (
                <PodiumCard
                  key={p.employeeId}
                  place={p}
                  placeIndex={i}
                  isYou={p.employeeId === highlightEmployeeId}
                />
              ))}
            </div>

            {rest.length > 0 ? (
              <LeaderboardList
                rest={rest}
                highlightEmployeeId={highlightEmployeeId}
                linkNames={linkNames}
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One podium place. The three cards are bottom-aligned (`items-end` on the
 * grid) and the winner is taller + heavier, so the row reads as an actual
 * podium — the winner leads on SIZE, ELEVATION, border weight and a shadow, not
 * only colour. Runner-ups sit a step lower. Generous vertical rhythm between
 * each line keeps it from feeling cramped.
 */
function PodiumCard({
  place,
  placeIndex,
  isYou,
}: {
  place: RankedEmployee;
  placeIndex: number;
  isYou: boolean;
}) {
  const isWinner = placeIndex === 0;
  const style = RANK_STYLE[placeIndex];
  // Visual order is 2nd · 1st · 3rd at every width — the podium reads as a
  // podium even when it is small.
  const order = ["order-2", "order-1", "order-3"][placeIndex];

  return (
    <div
      className={cn(
        // h-full + justify-center: all three cards share one height (so the
        // podium matches the list panel beside it) and their content stays
        // vertically centred. The winner leads on border weight, a shadow and
        // larger avatar/medal/score rather than on height.
        "rounded-xl border flex flex-col items-center justify-center text-center min-w-0 h-full",
        order,
        style.card,
        isWinner ? "border-2 shadow-md shadow-black/5 px-3 py-6" : "px-3 py-5",
        isYou && "ring-2 ring-inset ring-primary/50",
      )}
    >
      <div className="relative mb-4">
        <Avatar className={cn(isWinner ? "h-14 w-14" : "h-11 w-11", style.ring)}>
          {place.employee.avatar_url ? (
            <AvatarImage src={place.employee.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className={cn(isWinner ? "text-sm" : "text-xs")}>
            {initialsFor(place)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-2 left-1/2 -translate-x-1/2 leading-none drop-shadow-sm",
            isWinner ? "text-2xl" : "text-lg",
          )}
          aria-hidden
        >
          {MEDAL[placeIndex]}
        </span>
      </div>

      <div
        className={cn(
          "uppercase tracking-[0.08em] font-semibold leading-tight mb-2",
          isWinner ? "text-[11px]" : "text-[10px]",
          style.text,
        )}
      >
        {PLACE_LABEL[placeIndex]}
      </div>

      {/* Fixed min-height so a one- vs two-line name doesn't misalign the
          scores across the three cards. */}
      <div className="flex items-center justify-center gap-1 min-w-0 w-full min-h-[2.5rem] mb-3">
        <span
          title={displayName(place)}
          className={cn(
            "truncate leading-snug",
            isWinner ? "text-sm font-semibold" : "text-[13px] font-medium",
          )}
        >
          {displayName(place)}
        </span>
        {isYou ? (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
            You
          </Badge>
        ) : null}
      </div>

      <div
        className={cn(
          "font-bold tabular-nums leading-none mb-3.5",
          isWinner ? "text-3xl" : "text-2xl",
          style.text,
        )}
      >
        {formatScore(place.score)}
      </div>

      <ScoreBar
        score={place.score}
        fill={style.bar}
        className={cn("w-full mb-3", isWinner && "h-2")}
      />

      <div className="text-[11px] text-muted-foreground tabular-nums">
        {place.postCount} {place.postCount === 1 ? "post" : "posts"}
        <LateSuffix count={place.lateCount} />
      </div>
    </div>
  );
}

/**
 * Everyone below the podium, in one fixed-height scroller rather than an
 * expanding panel — the card's height then never depends on headcount. When
 * the viewer is in the list the scroller opens already positioned on their
 * row, so they find themselves without the card repeating their name.
 */
function LeaderboardList({
  rest,
  highlightEmployeeId,
  linkNames,
}: {
  rest: RankedEmployee[];
  highlightEmployeeId?: string;
  linkNames: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selfRef = useRef<HTMLTableRowElement>(null);
  const anyLate = rest.some((r) => r.lateCount > 0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const self = selfRef.current;
    if (!scroller || !self) return;
    // Scroll the container only — scrollIntoView would also move the page.
    // Land the row flush under the sticky header rather than centring it:
    // centring stops mid-row and leaves a sliver of the row above peeking out
    // from under the header, which reads as a rendering glitch.
    // Measured off rects, not offsetTop: offsetTop is relative to the nearest
    // POSITIONED ancestor, which isn't this scroller, so it lands a few pixels
    // out and leaves a sliver of the previous row under the sticky header.
    const head = scroller.querySelector("thead");
    const headHeight = head ? head.getBoundingClientRect().height : 0;
    const delta = self.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop = Math.max(0, scroller.scrollTop + delta - headHeight);
  }, [highlightEmployeeId]);

  return (
    // The list matches the podium's height exactly (aligned tops and bottoms).
    // The panel is absolutely positioned inside a height-following wrapper so
    // the roster's length never inflates the shared row height — the podium
    // drives the height and the list just fills it and scrolls. min-h-[15rem]
    // gives it a sensible height when stacked below the podium on small screens.
    <div className="relative min-w-0 h-full min-h-[15rem]">
      <div className="absolute inset-0 rounded-lg border border-border/70 bg-background/40 flex flex-col min-w-0">
        <div ref={scrollerRef} className="overflow-y-auto themed-scroll min-h-0 min-w-0 flex-1">
          <table className="w-full text-sm table-fixed">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 bg-card z-10">
              <tr className="border-b border-border/70">
                <th className="text-left font-medium px-3 py-2 w-8">#</th>
                <th className="text-left font-medium px-3 py-2">Employee</th>
                <th className="text-left font-medium px-3 py-2 w-24">Score</th>
                <th className="text-right font-medium px-3 py-2 w-12">Posts</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((s) => (
                <RankRow
                  key={s.employeeId}
                  place={s}
                  isYou={s.employeeId === highlightEmployeeId}
                  rowRef={s.employeeId === highlightEmployeeId ? selfRef : undefined}
                  linkNames={linkNames}
                />
              ))}
            </tbody>
          </table>
        </div>

        {anyLate ? (
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/70">
            * uploaded after the cutoff — tracked, not ranked.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RankRow({
  place,
  isYou,
  rowRef,
  linkNames,
}: {
  place: RankedEmployee;
  isYou: boolean;
  rowRef?: React.Ref<HTMLTableRowElement>;
  linkNames: boolean;
}) {
  const name = displayName(place);
  const ranked = place.postCount > 0;
  return (
    <tr
      ref={rowRef}
      className={cn(
        "border-b border-border/60 last:border-0 transition-colors hover:bg-muted/60",
        isYou && "bg-primary/10",
      )}
    >
      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
        {place.rank > 0 ? place.rank : "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="h-5 w-5 shrink-0 hidden sm:flex">
            {place.employee.avatar_url ? (
              <AvatarImage src={place.employee.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="text-[9px]">{initialsFor(place)}</AvatarFallback>
          </Avatar>
          {linkNames ? (
            <Link
              href={`/team/${place.employeeId}`}
              className={cn("hover:underline truncate", isYou ? "font-semibold" : "font-medium")}
            >
              {name}
            </Link>
          ) : (
            <span className={cn("truncate", isYou ? "font-semibold" : "font-medium")}>{name}</span>
          )}
          {isYou ? (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
              You
            </Badge>
          ) : !ranked ? (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 shrink-0 whitespace-nowrap hidden sm:inline-flex"
            >
              no uploads
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {ranked ? (
          <div className="flex items-center gap-1.5">
            <ScoreBar score={place.score} className="flex-1 min-w-[2rem]" />
            <span className="text-[11px] font-medium tabular-nums w-7 text-right">
              {formatScore(place.score)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {place.postCount}
        <LateSuffix count={place.lateCount} />
      </td>
    </tr>
  );
}
