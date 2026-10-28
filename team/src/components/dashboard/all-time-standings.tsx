"use client";

import { useState } from "react";
import Link from "next/link";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatNumber } from "@/lib/utils";
import { Movement, RANK_STYLE, ScoreBar, formatScore } from "./leaderboard-parts";
import type { AllTimeStanding } from "@/lib/monthly-stats";

interface Props {
  standings: AllTimeStanding[];
  /** Highlight the logged-in member's row. */
  highlightEmployeeId?: string;
  /** Names link to /team/{id} (admin-only route). */
  linkNames?: boolean;
  /**
   * Report month the movement is measured from, e.g. "August 2026" — the
   * arrows compare against how the board stood before it began.
   */
  sinceLabel?: string;
  /**
   * Show every row with no collapse/expand toggle — used on the dedicated
   * standings page, where the full table IS the content.
   */
  showAll?: boolean;
}

/**
 * Career table: every post an employee has ever filed, ranked by the same
 * Performance Score, with the movement arrows.
 *
 * Movement lives here rather than on the monthly card for a reason — a
 * month-to-month comparison reset anyone who skipped a month to "new", which
 * made the arrows unreadable. Against the all-time board, a quiet month simply
 * costs you places, and "new" means what it says.
 */
export function AllTimeStandings({
  standings,
  highlightEmployeeId,
  linkNames = true,
  sinceLabel,
  showAll = false,
}: Props) {
  const [toggled, setExpanded] = useState(false);
  const expanded = showAll || toggled;
  const posted = standings.filter((s) => s.rank > 0);
  const notPosted = standings.length - posted.length;

  // Collapsed, the table is just your own line — the whole board is one click
  // away but isn't the default wall of names. With no viewer to single out
  // (an admin whose account isn't on the board) the top three stand in.
  const self = highlightEmployeeId
    ? standings.find((s) => s.employeeId === highlightEmployeeId) ?? null
    : null;
  const collapsed = self ? [self] : standings.slice(0, 3);
  const visible = expanded ? standings : collapsed;
  const hiddenCount = standings.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">All-time standings</CardTitle>
            <CardDescription>
              Every post ever filed.{" "}
              {sinceLabel
                ? `Arrows show places moved since ${sinceLabel} began.`
                : "Arrows show places moved over the last month."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {posted.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No posts have been uploaded yet — standings appear once the first one lands.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium px-3 sm:px-6 py-2 w-20">#</th>
                  <th className="text-left font-medium px-2 py-2">Employee</th>
                  <th className="text-left font-medium px-2 py-2 w-28 sm:w-56 lg:w-72">Score</th>
                  <th className="text-right font-medium px-2 py-2 w-16 lg:w-24">Posts</th>
                  <th className="text-right font-medium px-2 py-2 w-24 lg:w-36 whitespace-nowrap hidden sm:table-cell">
                    Total reach
                  </th>
                  <th className="text-right font-medium px-2 sm:px-6 py-2 w-24 lg:w-36 whitespace-nowrap hidden md:table-cell">
                    Total impr.
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <StandingRow
                    key={s.employeeId}
                    standing={s}
                    isYou={s.employeeId === highlightEmployeeId}
                    linkNames={linkNames}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {expanded && notPosted > 0 && posted.length > 0 ? (
          <p className="px-3 sm:px-6 py-2.5 text-xs text-muted-foreground border-t border-border">
            {notPosted} {notPosted === 1 ? "employee has" : "employees have"} not posted yet, so
            {notPosted === 1 ? " has" : " have"} no standing to move.
          </p>
        ) : null}

        {!showAll && (hiddenCount > 0 || expanded) ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 border-t border-border"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> Show full standings ({hiddenCount} more)
              </>
            )}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StandingRow({
  standing,
  isYou,
  linkNames,
}: {
  standing: AllTimeStanding;
  isYou: boolean;
  linkNames: boolean;
}) {
  const name = standing.employee.name ?? standing.employee.email;
  const initials = name.slice(0, 2).toUpperCase();
  const ranked = standing.rank > 0;
  // Top three carry the same gold / silver / bronze as the monthly podium.
  const rankStyle = ranked && standing.rank <= 3 ? RANK_STYLE[standing.rank - 1] : null;

  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-muted/60",
        isYou && "bg-primary/10",
      )}
    >
      <td className="px-3 sm:px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "tabular-nums",
              rankStyle ? cn("font-semibold", rankStyle.text) : "text-muted-foreground",
            )}
          >
            {ranked ? standing.rank : "—"}
          </span>
          <Movement rank={standing.rank} previousRank={standing.previousRank} />
        </div>
      </td>

      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6 shrink-0 hidden sm:flex">
            {standing.employee.avatar_url ? (
              <AvatarImage src={standing.employee.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          {linkNames ? (
            <Link
              href={`/team/${standing.employeeId}`}
              className={cn("hover:underline truncate", isYou ? "font-semibold" : "font-medium")}
            >
              {name}
            </Link>
          ) : (
            <span className={cn("truncate", isYou ? "font-semibold" : "font-medium")}>{name}</span>
          )}
          {isYou ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              You
            </Badge>
          ) : !ranked ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap"
            >
              no uploads
            </Badge>
          ) : null}
        </div>
      </td>

      <td className="px-2 py-2.5">
        {ranked ? (
          <div className="flex items-center gap-2">
            <ScoreBar
              score={standing.score}
              fill={rankStyle?.bar}
              className="flex-1 min-w-[2.5rem]"
            />
            <span className="text-xs font-medium tabular-nums w-8 text-right">
              {formatScore(standing.score)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-2 py-2.5 text-right tabular-nums">{standing.postCount}</td>
      <td className="px-2 py-2.5 text-right tabular-nums hidden sm:table-cell">
        {ranked ? formatNumber(standing.totalReach) : "—"}
      </td>
      <td className="px-2 sm:px-6 py-2.5 text-right tabular-nums hidden md:table-cell">
        {ranked ? formatNumber(standing.totalImpressions) : "—"}
      </td>
    </tr>
  );
}
