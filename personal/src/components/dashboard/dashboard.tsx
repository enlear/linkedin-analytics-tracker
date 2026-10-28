"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Heart,
  Lock,
  Percent,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { FollowerChart, TrendChart, WeekdayChart, type TrendMetric } from "@/components/dashboard/charts";
import { Dropzone } from "@/components/import/dropzone";
import { ExportSteps } from "@/components/welcome";
import type { Dataset } from "@/lib/dataset";
import {
  RANGE_OPTIONS,
  demographicsByCategory,
  engagementSeries,
  followerSeries,
  latestFollowerTotal,
  topPosts,
  totals,
  weekdayPerformance,
  windows,
  type RangeKey,
} from "@/lib/insights";
import { cn, formatNumber } from "@/lib/utils";

interface DashboardProps {
  dataset: Dataset;
  onFiles: (files: File[]) => Promise<void>;
  onClear: () => Promise<void>;
  onExportJson: () => void;
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export function Dashboard({ dataset, onFiles, onClear, onExportJson }: DashboardProps) {
  const [range, setRange] = useState<RangeKey>("90d");
  const [metric, setMetric] = useState<TrendMetric>("impressions");
  const [postSort, setPostSort] = useState<"impressions" | "engagements">("impressions");

  const win = useMemo(() => windows(dataset, range), [dataset, range]);
  const view = useMemo(() => {
    if (!win) return null;
    return {
      current: totals(dataset, win.current),
      previous: win.previous ? totals(dataset, win.previous) : null,
      series: engagementSeries(dataset, win.current),
      followers: followerSeries(dataset, win.current),
      weekday: weekdayPerformance(dataset.posts),
      demographics: demographicsByCategory(dataset.demographics.entries),
    };
  }, [dataset, win]);
  const followerTotal = latestFollowerTotal(dataset);
  const posts = topPosts(dataset.posts, postSort, win?.current ?? null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your LinkedIn analytics</h1>
          {win ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {fmtDate(win.current.start)} – {fmtDate(win.current.end)}
            </p>
          ) : null}
        </div>
        <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Date range">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors",
                range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {view ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiTile label="Impressions" value={view.current.impressions} previous={view.previous?.impressions} previousLabel="prev. period" icon={Eye} />
          <KpiTile label="Engagements" value={view.current.engagements} previous={view.previous?.engagements} previousLabel="prev. period" icon={Heart} />
          <RateTile rate={view.current.engagementRate} />
          <KpiTile label="New followers" value={view.current.newFollowers} previous={view.previous?.newFollowers} previousLabel="prev. period" icon={UserPlus} />
          <KpiTile label="Followers" value={followerTotal?.total ?? null} icon={Users} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
            <div>
              <CardTitle className="text-base">{metric === "impressions" ? "Impressions" : "Engagements"} over time</CardTitle>
              <CardDescription>{view?.series.bucket === "week" ? "Weekly totals" : "Daily totals"}</CardDescription>
            </div>
            <Toggle
              value={metric}
              onChange={setMetric}
              options={[
                ["impressions", "Impressions"],
                ["engagements", "Engagements"],
              ]}
            />
          </CardHeader>
          <CardContent>
            {view && view.series.points.length > 0 ? (
              <TrendChart points={view.series.points} metric={metric} bucket={view.series.bucket} />
            ) : (
              <Empty>No daily data in this export.</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best day to post</CardTitle>
            <CardDescription>Average engagement of your top posts by weekday published.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {view && view.weekday.stats.some((s) => s.posts > 0) ? (
              <>
                {view.weekday.best ? (
                  <div className="text-sm">
                    <span className="text-2xl font-semibold">{view.weekday.best.day}</span>{" "}
                    <span className="text-muted-foreground">performs best ({view.weekday.best.posts} posts)</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Not enough posts yet to recommend a day.</div>
                )}
                <WeekdayChart stats={view.weekday.stats} best={view.weekday.best} />
                <p className="text-xs text-muted-foreground">
                  LinkedIn&apos;s export has publish dates but not times, so time-of-day can&apos;t be analysed.
                </p>
              </>
            ) : (
              <Empty>No posts with publish dates yet.</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
            <div>
              <CardTitle className="text-base">Top posts</CardTitle>
              <CardDescription>Published in the selected range. Click to open on LinkedIn.</CardDescription>
            </div>
            <Toggle
              value={postSort}
              onChange={setPostSort}
              options={[
                ["impressions", "Impressions"],
                ["engagements", "Engagements"],
              ]}
            />
          </CardHeader>
          <CardContent>
            {posts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-2 font-normal">#</th>
                      <th className="py-2 pr-2 font-normal">Published</th>
                      <th className="py-2 pr-2 font-normal text-right">Impressions</th>
                      <th className="py-2 pr-2 font-normal text-right">Engagements</th>
                      <th className="py-2 font-normal text-right">Post</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p, i) => (
                      <tr key={p.url} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{p.publishedOn ? fmtDate(p.publishedOn) : "—"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{p.impressions?.toLocaleString() ?? "—"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{p.engagements?.toLocaleString() ?? "—"}</td>
                        <td className="py-2 text-right">
                          <a href={p.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No posts in this range.</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follower growth</CardTitle>
            <CardDescription>
              {followerTotal ? `${followerTotal.total.toLocaleString()} followers on ${fmtDate(followerTotal.date)}` : "Total followers"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view && view.followers.length > 1 ? <FollowerChart points={view.followers} /> : <Empty>No follower data.</Empty>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience</CardTitle>
          <CardDescription>
            Who sees your posts{dataset.demographics.asOf ? `, as of ${fmtDate(dataset.demographics.asOf)}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view && view.demographics.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {view.demographics.map((group) => (
                <div key={group.category} className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{group.category}</div>
                  {group.entries.slice(0, 5).map((e) => (
                    <div key={e.value} className="space-y-1" title={`${e.value}: ${(e.share * 100).toFixed(1)}%`}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{e.value}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {e.share < 0.01 ? "<1" : Math.round(e.share * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, e.share * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <Empty>No demographics in your exports.</Empty>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add another export</CardTitle>
            <CardDescription>Overlapping dates and posts are de-duplicated automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dropzone onFiles={onFiles} compact />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">How do I export from LinkedIn?</summary>
              <div className="pt-3">
                <ExportSteps />
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Your data
            </CardTitle>
            <CardDescription>Stored only in this browser. Nothing has been uploaded anywhere.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {[...dataset.imports].reverse().map((imp) => (
                <li key={imp.id} className="flex items-start gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">{imp.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {imp.period ? `${fmtDate(imp.period.start)} – ${fmtDate(imp.period.end)}` : "Unknown period"}
                      {imp.impressions != null ? ` · ${formatNumber(imp.impressions)} impressions` : ""}
                    </div>
                  </div>
                  {imp.warnings.length > 0 ? (
                    <Badge variant="outline" className="ml-auto shrink-0" title={imp.warnings.join("\n")}>
                      partial
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onExportJson}>
                <Download className="h-4 w-4" /> Back up as JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Delete all imported analytics from this browser? This can't be undone.")) void onClear();
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete all data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RateTile({ rate }: { rate: number | null }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Engagement rate</div>
        <div className="w-7 h-7 rounded-md bg-muted/70 text-muted-foreground flex items-center justify-center">
          <Percent className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums leading-none">
        {rate == null ? "—" : `${(rate * 100).toFixed(1)}%`}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground min-h-4">engagements ÷ impressions</div>
    </div>
  );
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5 shrink-0">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            "px-2.5 py-1 text-xs rounded",
            value === key ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
