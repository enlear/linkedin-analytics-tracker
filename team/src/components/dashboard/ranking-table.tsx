"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShowMoreToggle } from "./show-more";
import { DeleteEmployeeButton } from "./delete-employee-button";
import { cn, formatNumber } from "@/lib/utils";
import type { RankedEmployee } from "@/lib/monthly-stats";

type Variant = "compact" | "full";

interface Props {
  title: string;
  rows: RankedEmployee[];
  initialCount: number;
  variant?: Variant;
  // Show a per-row delete button (admin-only, used on /team).
  enableDelete?: boolean;
  // Caller's own employeeId — the row matching this id won't show the delete
  // button so an admin can't accidentally nuke their own account.
  currentEmployeeId?: string;
}

export function RankingTable({
  title,
  rows,
  initialCount,
  variant = "compact",
  enableDelete = false,
  currentEmployeeId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initialCount);
  const hidden = Math.max(0, rows.length - initialCount);
  // Posts uploaded after the month's cutoff are shown but excluded from every
  // figure in the table — footnote them so the numbers aren't read as wrong.
  const anyLate = rows.some((r) => r.lateCount > 0);
  // Same gold / silver / bronze as the podium in winner-card, so a given place
  // looks the same wherever the ranking is shown.
  const rankColor = ["text-amber-700 dark:text-amber-400", "text-slate-600 dark:text-slate-400", "text-orange-800 dark:text-orange-500"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed sm:table-auto">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                {variant === "compact" ? (
                  <th className="text-left font-medium px-2 sm:px-4 py-2 w-8">#</th>
                ) : null}
                <th className="text-left font-medium px-2 sm:px-4 py-2">Employee</th>
                <th className="text-right font-medium px-2 sm:px-4 py-2 w-14">Posts</th>
                <th className="text-right font-medium px-2 sm:px-4 py-2 w-20">
                  <span className="sm:hidden">Reach</span>
                  <span className="hidden sm:inline">Avg reach</span>
                </th>
                <th className="text-right font-medium px-2 sm:px-4 py-2 w-20 hidden sm:table-cell">
                  Avg impr.
                </th>
                {variant === "full" ? (
                  <>
                    <th className="text-right font-medium px-2 sm:px-4 py-2 hidden md:table-cell">
                      Total reach
                    </th>
                    <th className="text-right font-medium px-2 sm:px-4 py-2 hidden md:table-cell">
                      Total impr.
                    </th>
                    <th className="text-right font-medium px-2 sm:px-4 py-2 hidden sm:table-cell">
                      Status
                    </th>
                    {enableDelete ? (
                      <th className="text-right font-medium px-3 sm:px-4 py-2 w-16"></th>
                    ) : null}
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.employeeId} className="border-b border-border last:border-0 align-middle">
                  {variant === "compact" ? (
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 tabular-nums",
                        s.rank >= 1 && s.rank <= 3
                          ? cn("font-semibold", rankColor[s.rank - 1])
                          : "text-muted-foreground",
                      )}
                    >
                      {s.rank > 0 ? s.rank : "—"}
                    </td>
                  ) : null}
                  <td className="px-2 sm:px-4 py-2">
                    <Link
                      href={`/team/${s.employeeId}`}
                      className="font-medium hover:underline break-words"
                    >
                      {s.employee.name ?? s.employee.email}
                    </Link>
                    {variant === "full" ? (
                      <div className="text-xs text-muted-foreground mt-0.5 break-all">
                        {s.employee.email}
                      </div>
                    ) : s.postCount === 0 ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        no uploads
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right">
                    {s.postCount}
                    {s.lateCount > 0 ? (
                      <span
                        className="ml-1 text-xs text-muted-foreground"
                        title={`${s.lateCount} uploaded after the cutoff — tracked, not ranked`}
                      >
                        +{s.lateCount}*
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right font-medium">
                    {s.postCount > 0 ? formatNumber(Math.round(s.avgReach)) : "—"}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right hidden sm:table-cell">
                    {s.postCount > 0 ? formatNumber(Math.round(s.avgImpressions)) : "—"}
                  </td>
                  {variant === "full" ? (
                    <>
                      <td className="px-2 sm:px-4 py-2 text-right hidden md:table-cell">
                        {s.postCount > 0 ? formatNumber(s.totalReach) : "—"}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right hidden md:table-cell">
                        {s.postCount > 0 ? formatNumber(s.totalImpressions) : "—"}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right hidden sm:table-cell">
                        {s.postCount > 0 ? (
                          <Badge variant="success">Uploaded</Badge>
                        ) : (
                          <Badge variant="outline">No uploads</Badge>
                        )}
                      </td>
                      {enableDelete ? (
                        <td className="px-3 sm:px-4 py-2 text-right align-middle">
                          {s.employeeId !== currentEmployeeId ? (
                            <DeleteEmployeeButton
                              employeeId={s.employeeId}
                              employeeName={s.employee.name}
                              employeeEmail={s.employee.email}
                            />
                          ) : null}
                        </td>
                      ) : null}
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {anyLate ? (
          <p className="px-2 sm:px-4 py-2 text-xs text-muted-foreground border-t border-border">
            * uploaded after the cutoff — kept for progress tracking, not counted in the ranking.
          </p>
        ) : null}
      </CardContent>
      <ShowMoreToggle
        expanded={expanded}
        hiddenCount={hidden}
        itemLabel="employees"
        onToggle={() => setExpanded((e) => !e)}
      />
    </Card>
  );
}
