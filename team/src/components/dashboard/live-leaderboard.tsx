"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MEDAL, RANK_STYLE, ScoreBar, formatScore, LateSuffix } from "./leaderboard-parts";
import type { RankedEmployee } from "@/lib/monthly-stats";

// How many rows stay visible before the manual "show all" expansion — the top
// three positions, as requested.
const INITIAL_VISIBLE = 3;

export interface LiveLeaderboardProps {
  /** Full current-period ranking (everyone), leaders first. */
  rows: RankedEmployee[];
  periodLabel: string;
  rangeLabel: string;
  /** Lightly highlight this employee (the logged-in member). */
  highlightEmployeeId?: string;
  /** Names link to /team/{id} (admin-only route) — members pass false. */
  linkNames?: boolean;
  /** After the cutoff the board is settled — show "closed" instead of "live". */
  locked?: boolean;
  /**
   * Optional controlled expand state — lets a parent react to the board
   * growing (e.g. pinning the size of the card beside it). Uncontrolled when
   * omitted.
   */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

function displayName(place: RankedEmployee): string {
  return place.employee.name ?? place.employee.email;
}

function initialsFor(place: RankedEmployee): string {
  return displayName(place).slice(0, 2).toUpperCase();
}

export function LiveLeaderboard({
  rows,
  periodLabel,
  rangeLabel,
  highlightEmployeeId,
  linkNames = true,
  locked = false,
  expanded: controlledExpanded,
  onExpandedChange,
}: LiveLeaderboardProps) {
  const [ownExpanded, setOwnExpanded] = useState(false);
  const expanded = controlledExpanded ?? ownExpanded;
  const setExpanded = (update: (prev: boolean) => boolean) => {
    const next = update(expanded);
    setOwnExpanded(next);
    onExpandedChange?.(next);
  };

  const participants = rows.filter((r) => r.postCount > 0).length;
  const visible = expanded ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, rows.length - INITIAL_VISIBLE);

  return (
    <Card className="border-emerald-500/20">
      <CardContent className="pt-5 pb-4">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight">
                This month&apos;s leaderboard — {periodLabel}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {rangeLabel} · updates as the team uploads
              </div>
            </div>
          </div>
          {locked ? (
            <Badge variant="outline" className="shrink-0 mt-0.5">
              Ranking closed
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0 mt-1">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          )}
        </header>

        {participants === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div className="text-sm font-medium">No posts uploaded yet this month</div>
            <p className="text-xs text-muted-foreground mt-1">
              The board fills in as the team uploads — be the first to get on it.
            </p>
          </div>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-border/60">
              {visible.map((place) => (
                <LiveRow
                  key={place.employeeId}
                  place={place}
                  isYou={place.employeeId === highlightEmployeeId}
                  linkNames={linkNames}
                />
              ))}
            </ol>

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-t border-border/60"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" /> Show all {rows.length} employees
                  </>
                )}
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LiveRow({
  place,
  isYou,
  linkNames,
}: {
  place: RankedEmployee;
  isYou: boolean;
  linkNames: boolean;
}) {
  const name = displayName(place);
  const ranked = place.postCount > 0;
  const isPodium = place.rank >= 1 && place.rank <= 3;
  const rankStyle = isPodium ? RANK_STYLE[place.rank - 1] : null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md",
        isYou && "bg-primary/10",
      )}
    >
      {/* Rank / medal */}
      <div className="w-7 shrink-0 flex items-center justify-center">
        {isPodium ? (
          <span className="text-lg leading-none" aria-hidden>
            {MEDAL[place.rank - 1]}
          </span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {ranked ? place.rank : "—"}
          </span>
        )}
      </div>

      <Avatar className="h-8 w-8 shrink-0">
        {place.employee.avatar_url ? (
          <AvatarImage src={place.employee.avatar_url} alt="" />
        ) : null}
        <AvatarFallback className="text-[10px]">{initialsFor(place)}</AvatarFallback>
      </Avatar>

      {/* Name + score bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {linkNames ? (
            <Link
              href={`/team/${place.employeeId}`}
              className={cn(
                "truncate hover:underline",
                isYou ? "font-semibold" : "font-medium",
              )}
            >
              {name}
            </Link>
          ) : (
            <span className={cn("truncate", isYou ? "font-semibold" : "font-medium")}>
              {name}
            </span>
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
        {ranked ? (
          <ScoreBar
            score={place.score}
            fill={rankStyle?.bar}
            className="mt-1.5 max-w-[16rem]"
          />
        ) : null}
      </div>

      {/* Score + posts */}
      <div className="text-right shrink-0 w-14">
        <div
          className={cn(
            "font-bold tabular-nums leading-none",
            isPodium ? rankStyle?.text : "text-foreground",
          )}
        >
          {ranked ? formatScore(place.score) : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
          {place.postCount} {place.postCount === 1 ? "post" : "posts"}
          <LateSuffix count={place.lateCount} />
        </div>
      </div>
    </li>
  );
}
