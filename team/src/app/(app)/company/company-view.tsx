"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  Send,
  TrendingUp,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyUploadDialog } from "./company-upload-dialog";
import { DeleteCompanyUploadButton } from "./delete-company-upload-button";

const CompanyDailyChart = dynamic(
  () => import("./company-daily-chart").then((m) => m.CompanyDailyChart),
  { ssr: false },
);
const TiktokDailyChart = dynamic(
  () => import("./tiktok-daily-chart").then((m) => m.TiktokDailyChart),
  { ssr: false },
);
const FacebookDailyChart = dynamic(
  () => import("./facebook-daily-chart").then((m) => m.FacebookDailyChart),
  { ssr: false },
);
const InstagramDailyChart = dynamic(
  () => import("./instagram-daily-chart").then((m) => m.InstagramDailyChart),
  { ssr: false },
);
import { downloadOriginalUpload } from "./company-actions";
import { FacebookFetchButton } from "./facebook-fetch-button";
import { InstagramFetchButton } from "./instagram-fetch-button";
import { cn, formatDelta, formatNumber } from "@/lib/utils";
import {
  PLATFORM_LABELS,
  SUPPORTED_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social-platforms";
import type {
  CompanyDailyMetricRow,
  CompanyPostRow,
  CompanyUploadSummary,
  FacebookDailyMetricRow,
  InstagramDailyMetricRow,
  TiktokDailyMetricRow,
} from "@/lib/data/company-analytics";

const ALL_PLATFORMS: SocialPlatform[] = ["linkedin", "tiktok", "facebook", "instagram"];

interface Props {
  platform: SocialPlatform;
  uploads: CompanyUploadSummary[];
  selectedUploadId: string | null;
  metrics: CompanyDailyMetricRow[];
  posts: CompanyPostRow[];
  previousMetrics: CompanyDailyMetricRow[];
  tiktokMetrics: TiktokDailyMetricRow[];
  previousTiktokMetrics: TiktokDailyMetricRow[];
  facebookMetrics: FacebookDailyMetricRow[];
  previousFacebookMetrics: FacebookDailyMetricRow[];
  instagramMetrics: InstagramDailyMetricRow[];
  previousInstagramMetrics: InstagramDailyMetricRow[];
  metaConnected: boolean;
  instagramConnected: boolean;
  previousLabel: string | null;
  fetchError: string | null;
}

function sumKey<T extends object>(rows: T[], key: keyof T) {
  return rows.reduce(
    (acc, r) => acc + (typeof r[key] === "number" ? (r[key] as number) : 0),
    0,
  );
}

function avgKey(rows: CompanyDailyMetricRow[], key: keyof CompanyDailyMetricRow) {
  if (rows.length === 0) return 0;
  return sumKey(rows, key) / rows.length;
}

function metricTotals(rows: CompanyDailyMetricRow[]) {
  return {
    impressions: sumKey(rows, "impressions"),
    impressionsOrganic: sumKey(rows, "impressionsOrganic"),
    impressionsSponsored: sumKey(rows, "impressionsSponsored"),
    uniqueImpressions: sumKey(rows, "uniqueImpressions"),
    clicks: sumKey(rows, "clicks"),
    clicksOrganic: sumKey(rows, "clicksOrganic"),
    clicksSponsored: sumKey(rows, "clicksSponsored"),
    reactions: sumKey(rows, "reactions"),
    reactionsOrganic: sumKey(rows, "reactionsOrganic"),
    reactionsSponsored: sumKey(rows, "reactionsSponsored"),
    comments: sumKey(rows, "comments"),
    commentsOrganic: sumKey(rows, "commentsOrganic"),
    commentsSponsored: sumKey(rows, "commentsSponsored"),
    reposts: sumKey(rows, "reposts"),
    repostsOrganic: sumKey(rows, "repostsOrganic"),
    repostsSponsored: sumKey(rows, "repostsSponsored"),
    avgEngagementRate: avgKey(rows, "engagementRate"),
    avgEngagementRateOrganic: avgKey(rows, "engagementRateOrganic"),
    avgEngagementRateSponsored: avgKey(rows, "engagementRateSponsored"),
  };
}

// Returns the [Organic, Sponsored] sub-stat pair only when at least one is
// non-zero. Exports without the organic/sponsored columns leave both
// at 0 — showing them would just display "0 / 0" misleadingly.
function breakdown(
  organic: number,
  sponsored: number,
  format: (n: number) => string,
): Array<{ label: string; value: string }> {
  if (organic === 0 && sponsored === 0) return [];
  return [
    { label: "Organic", value: format(organic) },
    { label: "Sponsored", value: format(sponsored) },
  ];
}

function rateBreakdown(
  organic: number,
  sponsored: number,
): Array<{ label: string; value: string }> {
  if (organic === 0 && sponsored === 0) return [];
  return [
    { label: "Organic", value: `${(organic * 100).toFixed(2)}%` },
    { label: "Sponsored", value: `${(sponsored * 100).toFixed(2)}%` },
  ];
}

function postTotals(rows: CompanyPostRow[]) {
  return {
    count: rows.length,
    impressions: sumKey(rows, "impressions"),
    views: sumKey(rows, "views"),
    offsiteViews: sumKey(rows, "offsiteViews"),
    clicks: sumKey(rows, "clicks"),
    likes: sumKey(rows, "likes"),
    comments: sumKey(rows, "comments"),
    reposts: sumKey(rows, "reposts"),
    follows: sumKey(rows, "follows"),
    avgEngagementRate:
      rows.length === 0 ? 0 : sumKey(rows, "engagementRate") / rows.length,
  };
}

export function CompanyAnalyticsView({
  platform,
  uploads,
  selectedUploadId,
  metrics,
  posts,
  previousMetrics,
  tiktokMetrics,
  previousTiktokMetrics,
  facebookMetrics,
  previousFacebookMetrics,
  instagramMetrics,
  previousInstagramMetrics,
  metaConnected,
  instagramConnected,
  previousLabel,
  fetchError,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Uploads displayed in the dropdown + past-uploads table are scoped to the
  // currently-active platform tab.
  const platformUploads = useMemo(
    () => uploads.filter((u) => u.platform === platform),
    [uploads, platform],
  );

  const selectedUpload = useMemo(
    () => platformUploads.find((u) => u.id === selectedUploadId) ?? null,
    [platformUploads, selectedUploadId],
  );

  const totals = useMemo(() => metricTotals(metrics), [metrics]);
  const previousTotals = useMemo(() => metricTotals(previousMetrics), [previousMetrics]);
  const postSums = useMemo(() => postTotals(posts), [posts]);
  const hasPrevious = previousMetrics.length > 0;

  const tiktokTotals = useMemo(() => tiktokMetricTotals(tiktokMetrics), [tiktokMetrics]);
  const previousTiktokTotals = useMemo(
    () => tiktokMetricTotals(previousTiktokMetrics),
    [previousTiktokMetrics],
  );
  const hasPreviousTiktok = previousTiktokMetrics.length > 0;

  const facebookTotals = useMemo(
    () => facebookMetricTotals(facebookMetrics),
    [facebookMetrics],
  );
  const previousFacebookTotals = useMemo(
    () => facebookMetricTotals(previousFacebookMetrics),
    [previousFacebookMetrics],
  );
  const hasPreviousFacebook = previousFacebookMetrics.length > 0;

  const instagramTotals = useMemo(
    () => instagramMetricTotals(instagramMetrics),
    [instagramMetrics],
  );
  const previousInstagramTotals = useMemo(
    () => instagramMetricTotals(previousInstagramMetrics),
    [previousInstagramMetrics],
  );
  const hasPreviousInstagram = previousInstagramMetrics.length > 0;

  const contentTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) {
      const key = p.contentType ?? p.postType ?? "Other";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [posts]);

  function selectUpload(id: string) {
    router.push(
      `/company?platform=${platform}&upload=${encodeURIComponent(id)}`,
    );
  }

  function selectPlatform(next: SocialPlatform) {
    if (next === platform) return;
    router.push(`/company?platform=${next}`);
  }

  async function handleDownload(uploadId: string, fileName: string) {
    try {
      await downloadOriginalUpload(uploadId, fileName);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="max-w-screen-2xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Company analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            {selectedUpload
              ? `Showing ${selectedUpload.monthLabel}.`
              : "Upload a monthly company analytics export to get started."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {platformUploads.length > 0 ? (
            <div className="relative">
              <select
                value={selectedUploadId ?? ""}
                onChange={(e) => selectUpload(e.target.value)}
                className="appearance-none inline-flex items-center h-9 rounded-md border border-input bg-background px-3 pr-9 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                aria-label="Select report month"
              >
                {platformUploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.monthLabel}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          ) : null}
          <Button onClick={() => setDialogOpen(true)}>
            <Building2 className="w-4 h-4" />
            Upload monthly report
          </Button>
        </div>
      </div>

      {/* ----- Platform tabs --------------------------------------------- */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {ALL_PLATFORMS.map((p) => {
          const enabled = SUPPORTED_PLATFORMS.includes(p);
          const active = platform === p;
          return (
            <button
              key={p}
              type="button"
              disabled={!enabled}
              onClick={() => selectPlatform(p)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                active
                  ? "bg-primary/10 text-foreground font-medium border border-primary/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                !enabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {PLATFORM_LABELS[p]}
              {!enabled ? (
                <span className="ml-1 text-[10px] uppercase tracking-wide">
                  Soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {fetchError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load company analytics</div>
          <div className="text-muted-foreground mt-1">{fetchError}</div>
        </div>
      ) : null}

      {/* ----- TikTok branch --------------------------------------------- */}
      {platform === "tiktok" ? (
        selectedUpload ? (
          <TiktokSection
            selectedUpload={selectedUpload}
            metrics={tiktokMetrics}
            previousMetrics={previousTiktokMetrics}
            totals={tiktokTotals}
            previousTotals={previousTiktokTotals}
            previousLabel={previousLabel}
            hasPrevious={hasPreviousTiktok}
          />
        ) : (
          <EmptyState onUpload={() => setDialogOpen(true)} platformLabel="TikTok" />
        )
      ) : null}

      {/* ----- Facebook branch ------------------------------------------ */}
      {platform === "facebook" ? (
        <FacebookSection
          connected={metaConnected}
          selectedUpload={selectedUpload}
          metrics={facebookMetrics}
          previousMetrics={previousFacebookMetrics}
          totals={facebookTotals}
          previousTotals={previousFacebookTotals}
          previousLabel={previousLabel}
          hasPrevious={hasPreviousFacebook}
        />
      ) : null}

      {/* ----- Instagram branch ----------------------------------------- */}
      {platform === "instagram" ? (
        <InstagramSection
          metaConnected={metaConnected}
          instagramConnected={instagramConnected}
          selectedUpload={selectedUpload}
          metrics={instagramMetrics}
          previousMetrics={previousInstagramMetrics}
          totals={instagramTotals}
          previousTotals={previousInstagramTotals}
          previousLabel={previousLabel}
          hasPrevious={hasPreviousInstagram}
        />
      ) : null}

      {/* ----- LinkedIn branch (the original layout) --------------------- */}
      {platform === "linkedin" && selectedUpload ? (
        <>
          {/* ------------------------------------------------------------ */}
          {/* Aggregated daily metrics — one card per main category, with  */}
          {/* organic / sponsored / total broken out as sub-stats inside.  */}
          {/* ------------------------------------------------------------ */}
          <SectionHeader
            title="Page metrics"
            subtitle="Aggregated for the selected month — organic + sponsored + total."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigStatCard
              icon={<Eye className="w-4 h-4" />}
              title="Impressions"
              value={formatNumber(totals.impressions)}
              delta={
                hasPrevious
                  ? formatDelta(totals.impressions, previousTotals.impressions)
                  : undefined
              }
              previousLabel={previousLabel}
              subStats={[
                ...breakdown(
                  totals.impressionsOrganic,
                  totals.impressionsSponsored,
                  formatNumber,
                ),
                { label: "Unique", value: formatNumber(totals.uniqueImpressions) },
                {
                  label: "Daily avg",
                  value:
                    metrics.length > 0
                      ? formatNumber(Math.round(totals.impressions / metrics.length))
                      : "—",
                },
              ]}
            />
            <BigStatCard
              icon={<MousePointerClick className="w-4 h-4" />}
              title="Clicks"
              value={formatNumber(totals.clicks)}
              delta={
                hasPrevious ? formatDelta(totals.clicks, previousTotals.clicks) : undefined
              }
              previousLabel={previousLabel}
              subStats={[
                ...breakdown(totals.clicksOrganic, totals.clicksSponsored, formatNumber),
                {
                  label: "CTR",
                  value:
                    totals.impressions > 0
                      ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`
                      : "—",
                },
              ]}
            />
            <BigStatCard
              icon={<TrendingUp className="w-4 h-4" />}
              title="Avg engagement rate"
              value={`${(totals.avgEngagementRate * 100).toFixed(2)}%`}
              delta={
                hasPrevious
                  ? formatDelta(totals.avgEngagementRate, previousTotals.avgEngagementRate)
                  : undefined
              }
              previousLabel={previousLabel}
              subStats={[
                ...rateBreakdown(
                  totals.avgEngagementRateOrganic,
                  totals.avgEngagementRateSponsored,
                ),
                { label: "Best day", value: bestDayLabel(metrics) },
                { label: "Best rate", value: bestRateLabel(metrics) },
              ]}
            />
            <BigStatCard
              icon={<Heart className="w-4 h-4" />}
              title="Reactions"
              value={formatNumber(totals.reactions)}
              delta={
                hasPrevious
                  ? formatDelta(totals.reactions, previousTotals.reactions)
                  : undefined
              }
              previousLabel={previousLabel}
              subStats={breakdown(
                totals.reactionsOrganic,
                totals.reactionsSponsored,
                formatNumber,
              )}
            />
            <BigStatCard
              icon={<MessageCircle className="w-4 h-4" />}
              title="Comments"
              value={formatNumber(totals.comments)}
              delta={
                hasPrevious
                  ? formatDelta(totals.comments, previousTotals.comments)
                  : undefined
              }
              previousLabel={previousLabel}
              subStats={breakdown(
                totals.commentsOrganic,
                totals.commentsSponsored,
                formatNumber,
              )}
            />
            <BigStatCard
              icon={<Repeat2 className="w-4 h-4" />}
              title="Reposts"
              value={formatNumber(totals.reposts)}
              delta={
                hasPrevious
                  ? formatDelta(totals.reposts, previousTotals.reposts)
                  : undefined
              }
              previousLabel={previousLabel}
              subStats={breakdown(
                totals.repostsOrganic,
                totals.repostsSponsored,
                formatNumber,
              )}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Daily impressions — {selectedUpload.monthLabel}
                {previousLabel ? (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    vs {previousLabel} (dotted)
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.length > 0 ? (
                <CompanyDailyChart
                  metrics={metrics}
                  previousMetrics={previousMetrics}
                  currentLabel={selectedUpload.monthLabel}
                  previousLabel={previousLabel}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No daily metric rows in this upload.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------------------------ */}
          {/* Post-level insights — derived from individual posts, not the */}
          {/* daily aggregated sheet. Visually separated so the two scopes */}
          {/* (page-wide vs post-level) don't get conflated.               */}
          {/* ------------------------------------------------------------ */}
          <SectionHeader
            title="Post insights"
            subtitle={`Aggregated across ${postSums.count} ${
              postSums.count === 1 ? "post" : "posts"
            } published in this period.`}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigStatCard
              icon={<Eye className="w-4 h-4" />}
              title="Views"
              value={formatNumber(postSums.views)}
              previousLabel={null}
              subStats={[
                { label: "Offsite", value: formatNumber(postSums.offsiteViews) },
                {
                  label: "Avg/post",
                  value:
                    postSums.count > 0
                      ? formatNumber(Math.round(postSums.views / postSums.count))
                      : "—",
                },
                { label: "Posts", value: String(postSums.count) },
              ]}
            />
            <BigStatCard
              icon={<Heart className="w-4 h-4" />}
              title="Likes"
              value={formatNumber(postSums.likes)}
              previousLabel={null}
              subStats={[
                { label: "Comments", value: formatNumber(postSums.comments) },
                { label: "Reposts", value: formatNumber(postSums.reposts) },
                {
                  label: "Best post",
                  value: formatNumber(
                    posts.reduce((best, p) => (p.likes > best ? p.likes : best), 0),
                  ),
                },
              ]}
            />
            <BigStatCard
              icon={<UserPlus className="w-4 h-4" />}
              title="Follows from posts"
              value={formatNumber(postSums.follows)}
              previousLabel={null}
              subStats={[
                {
                  label: "Avg/post",
                  value:
                    postSums.count > 0
                      ? (postSums.follows / postSums.count).toFixed(1)
                      : "—",
                },
                { label: "Clicks", value: formatNumber(postSums.clicks) },
                {
                  label: "Avg eng. rate",
                  value: `${(postSums.avgEngagementRate * 100).toFixed(2)}%`,
                },
              ]}
            />
          </div>

          {contentTypeBreakdown.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Content type breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {contentTypeBreakdown.map(([type, count]) => (
                    <div
                      key={type}
                      className="rounded-md border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {type}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-semibold">{count}</span>
                        <span className="text-xs text-muted-foreground">
                          {count === 1 ? "post" : "posts"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Top posts — {selectedUpload.monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {posts.length > 0 ? (
                <div className="max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left font-medium px-4 py-3">Post</th>
                        <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                          Posted by
                        </th>
                        <th className="text-right font-medium px-4 py-3">Impr.</th>
                        <th className="text-right font-medium px-4 py-3">Clicks</th>
                        <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                          Likes
                        </th>
                        <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                          Eng. rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-border last:border-b-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{p.postTitle ?? "—"}</span>
                              {p.postLink ? (
                                <a
                                  href={p.postLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                  aria-label="Open post on LinkedIn"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {p.postedBy ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatNumber(p.impressions)}
                          </td>
                          <td className="px-4 py-3 text-right">{formatNumber(p.clicks)}</td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            {formatNumber(p.likes)}
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            {(p.engagementRate * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  No posts in this upload.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {platform === "linkedin" && !selectedUpload ? (
        <EmptyState onUpload={() => setDialogOpen(true)} platformLabel="LinkedIn" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="w-4 h-4" />
            Past {PLATFORM_LABELS[platform]} uploads
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {platformUploads.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No {PLATFORM_LABELS[platform]} uploads yet.
            </p>
          ) : (
            <div className="max-h-[20rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium px-4 py-3">Month</th>
                    <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                      File
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                      Uploaded
                    </th>
                    <th className="text-right font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {platformUploads.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b border-border last:border-b-0 hover:bg-muted/30 ${
                        u.id === selectedUploadId ? "bg-muted/50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{u.monthLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-xs">
                        {u.fileName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {new Date(u.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* API fetches (Facebook/Instagram) have no original file. */}
                          {u.storagePath ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(u.id, u.fileName)}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          ) : null}
                          <DeleteCompanyUploadButton
                            uploadId={u.id}
                            monthLabel={u.monthLabel}
                            fileName={u.fileName}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPlatform={platform}
        onUploaded={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-border pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      ) : null}
    </div>
  );
}

interface BigStatProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  delta?: { percent: number; direction: "up" | "down" | "flat" };
  previousLabel: string | null;
  subStats: Array<{ label: string; value: string }>;
}

function BigStatCard({ icon, title, value, delta, previousLabel, subStats }: BigStatProps) {
  const Icon =
    delta?.direction === "up" ? ArrowUp : delta?.direction === "down" ? ArrowDown : ArrowRight;
  const deltaColor =
    delta?.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : delta?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  // 2 cols if 2 sub-stats, 2 cols by default; auto-fits 3+4 sub-stats too.
  const subCols = subStats.length >= 4 ? "grid-cols-2" : subStats.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            {icon}
            {title}
          </div>
          {delta ? (
            <div
              className={cn("flex items-center gap-0.5 text-xs", deltaColor)}
              title={previousLabel ? `vs ${previousLabel}` : undefined}
            >
              <Icon className="w-3 h-3" />
              {Math.abs(delta.percent).toFixed(1)}%
            </div>
          ) : null}
        </div>
        <div className="text-3xl font-semibold">{value}</div>
        {subStats.length > 0 ? (
          <div className={cn("grid gap-3 pt-3 border-t border-border", subCols)}>
            {subStats.map((s) => (
              <div key={s.label}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className="text-sm font-medium mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function bestDayLabel(metrics: CompanyDailyMetricRow[]): string {
  if (metrics.length === 0) return "—";
  const best = metrics.reduce((a, b) => (a.engagementRate >= b.engagementRate ? a : b));
  return best.date.slice(5); // MM-DD
}

function bestRateLabel(metrics: CompanyDailyMetricRow[]): string {
  if (metrics.length === 0) return "—";
  const best = Math.max(...metrics.map((m) => m.engagementRate));
  return `${(best * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// TikTok-specific helpers + section component
// ---------------------------------------------------------------------------

interface TiktokTotals {
  videoViews: number;
  profileViews: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  dayCount: number;
}

function tiktokMetricTotals(rows: TiktokDailyMetricRow[]): TiktokTotals {
  const videoViews = sumKey(rows, "videoViews");
  const profileViews = sumKey(rows, "profileViews");
  const likes = sumKey(rows, "likes");
  const comments = sumKey(rows, "comments");
  const shares = sumKey(rows, "shares");
  return {
    videoViews,
    profileViews,
    likes,
    comments,
    shares,
    engagement: likes + comments + shares,
    dayCount: rows.length,
  };
}

function EmptyState({
  onUpload,
  platformLabel,
}: {
  onUpload: () => void;
  platformLabel: string;
}) {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">
          No {platformLabel} analytics uploaded yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload your monthly {platformLabel} export to see daily metrics and
          comparisons.
        </p>
        <Button onClick={onUpload}>Upload monthly report</Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Facebook-specific helpers + section component
// ---------------------------------------------------------------------------

interface FacebookTotals {
  impressions: number;
  reach: number;
  engagedUsers: number;
  newFollowers: number;
  postImpressions: number;
  postEngagements: number;
  dayCount: number;
}

function facebookMetricTotals(rows: FacebookDailyMetricRow[]): FacebookTotals {
  return {
    impressions: sumKey(rows, "impressions"),
    reach: sumKey(rows, "reach"),
    engagedUsers: sumKey(rows, "engagedUsers"),
    newFollowers: sumKey(rows, "newFollowers"),
    postImpressions: sumKey(rows, "postImpressions"),
    postEngagements: sumKey(rows, "postEngagements"),
    dayCount: rows.length,
  };
}

function FacebookSection({
  connected,
  selectedUpload,
  metrics,
  previousMetrics,
  totals,
  previousTotals,
  previousLabel,
  hasPrevious,
}: {
  connected: boolean;
  selectedUpload: CompanyUploadSummary | null;
  metrics: FacebookDailyMetricRow[];
  previousMetrics: FacebookDailyMetricRow[];
  totals: FacebookTotals;
  previousTotals: FacebookTotals;
  previousLabel: string | null;
  hasPrevious: boolean;
}) {
  // Always show the fetch control at the top so the admin can pull a new
  // month without having to scroll past prior data.
  const fetchBar = (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {connected ? (
          <>
            <div className="text-sm text-muted-foreground">
              Pulls daily Page Insights from the Meta Graph API. Re-running for
              the same month replaces the existing data.
            </div>
            <FacebookFetchButton />
          </>
        ) : (
          <div className="text-sm">
            <div className="font-medium mb-1">Facebook isn&apos;t connected yet.</div>
            <div className="text-muted-foreground">
              Connect a Facebook Page in{" "}
              <a href="/settings" className="text-primary hover:underline">
                Settings
              </a>{" "}
              to enable monthly fetches.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!selectedUpload) {
    return (
      <>
        {fetchBar}
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">
              No Facebook months fetched yet
            </h2>
            <p className="text-sm text-muted-foreground">
              {connected
                ? "Pick a month above and click “Fetch this month.”"
                : "Connect Facebook in Settings, then come back here to fetch."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  // Field-mapping note (what we ACTUALLY get from Graph API):
  //   - postImpressions column = page_views_total → Meta calls this "Visits"
  //   - postEngagements column = page_post_engagements → "Content interactions"
  //   - newFollowers column   = page_follows → CUMULATIVE total follower count
  //     per day (not a daily delta), so we MAX it across days for "Total
  //     followers" rather than summing.
  // Several other metrics (page_post_impressions, _unique, page_total_actions)
  // come back as 0 from Meta v25 for our test page — likely deprecated or
  // require a higher access tier. We keep them in the schema so they populate
  // automatically if Meta brings them back, but we don't surface them here.
  const visits = totals.postImpressions;
  const previousVisits = previousTotals.postImpressions;
  const dailyAvgVisits = totals.dayCount > 0 ? Math.round(visits / totals.dayCount) : 0;
  const interactions = totals.postEngagements;
  const previousInteractions = previousTotals.postEngagements;
  // page_follows is cumulative — take the latest day's value as total followers.
  const totalFollowers = Math.max(
    0,
    ...metrics.map((m) => m.newFollowers),
  );
  const previousTotalFollowers = Math.max(
    0,
    ...previousMetrics.map((m) => m.newFollowers),
  );

  return (
    <>
      {fetchBar}

      <SectionHeader
        title="Facebook page metrics"
        subtitle={`Aggregated for ${selectedUpload.monthLabel}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStatCard
          icon={<Eye className="w-4 h-4" />}
          title="Visits"
          value={formatNumber(visits)}
          delta={hasPrevious ? formatDelta(visits, previousVisits) : undefined}
          previousLabel={previousLabel}
          subStats={[
            { label: "Daily avg", value: formatNumber(dailyAvgVisits) },
            { label: "Active days", value: String(totals.dayCount) },
          ]}
        />
        <BigStatCard
          icon={<Heart className="w-4 h-4" />}
          title="Content interactions"
          value={formatNumber(interactions)}
          delta={
            hasPrevious ? formatDelta(interactions, previousInteractions) : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            {
              label: "Eng. rate",
              value:
                visits > 0
                  ? `${((interactions / visits) * 100).toFixed(2)}%`
                  : "—",
            },
            {
              label: "Daily avg",
              value:
                totals.dayCount > 0
                  ? formatNumber(Math.round(interactions / totals.dayCount))
                  : "—",
            },
          ]}
        />
        <BigStatCard
          icon={<UserPlus className="w-4 h-4" />}
          title="Total followers"
          value={formatNumber(totalFollowers)}
          delta={
            hasPrevious && previousTotalFollowers > 0
              ? formatDelta(totalFollowers, previousTotalFollowers)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            {
              label: "Net change",
              value:
                hasPrevious && previousTotalFollowers > 0
                  ? `${totalFollowers - previousTotalFollowers >= 0 ? "+" : ""}${formatNumber(totalFollowers - previousTotalFollowers)}`
                  : "—",
            },
            { label: "Active days", value: String(totals.dayCount) },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily visits — {selectedUpload.monthLabel}
            {previousLabel ? (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                vs {previousLabel} (dotted)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <FacebookDailyChart
              metrics={metrics}
              previousMetrics={previousMetrics}
              currentLabel={selectedUpload.monthLabel}
              previousLabel={previousLabel}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No daily rows in this fetch.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily activity — {selectedUpload.monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No daily rows in this fetch.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto themed-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium px-4 py-3">Date</th>
                    <th className="text-right font-medium px-4 py-3">Visits</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Interactions
                    </th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Total followers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.date.slice(5)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNumber(m.postImpressions)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.postEngagements)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.newFollowers)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Instagram-specific helpers + section component
// ---------------------------------------------------------------------------

interface InstagramTotals {
  reach: number;
  views: number;
  profileViews: number;
  accountsEngaged: number;
  totalInteractions: number;
  // Snapshot of follower_count — UI takes MAX (cumulative metric), not sum.
  followerCount: number;
  dayCount: number;
}

function instagramMetricTotals(rows: InstagramDailyMetricRow[]): InstagramTotals {
  return {
    reach: sumKey(rows, "reach"),
    views: sumKey(rows, "views"),
    profileViews: sumKey(rows, "profileViews"),
    accountsEngaged: sumKey(rows, "accountsEngaged"),
    totalInteractions: sumKey(rows, "totalInteractions"),
    followerCount:
      rows.length === 0 ? 0 : Math.max(...rows.map((m) => m.followerCount)),
    dayCount: rows.length,
  };
}

function InstagramSection({
  metaConnected,
  instagramConnected,
  selectedUpload,
  metrics,
  previousMetrics,
  totals,
  previousTotals,
  previousLabel,
  hasPrevious,
}: {
  metaConnected: boolean;
  instagramConnected: boolean;
  selectedUpload: CompanyUploadSummary | null;
  metrics: InstagramDailyMetricRow[];
  previousMetrics: InstagramDailyMetricRow[];
  totals: InstagramTotals;
  previousTotals: InstagramTotals;
  previousLabel: string | null;
  hasPrevious: boolean;
}) {
  const fetchBar = (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {!metaConnected ? (
          <div className="text-sm">
            <div className="font-medium mb-1">Meta isn&apos;t connected yet.</div>
            <div className="text-muted-foreground">
              Connect a Facebook Page in{" "}
              <a href="/settings" className="text-primary hover:underline">
                Settings
              </a>{" "}
              first — the same token covers Instagram.
            </div>
          </div>
        ) : !instagramConnected ? (
          <div className="text-sm">
            <div className="font-medium mb-1">
              Instagram account isn&apos;t set on the Meta connection.
            </div>
            <div className="text-muted-foreground">
              Open{" "}
              <a href="/settings" className="text-primary hover:underline">
                Settings → Facebook connection
              </a>{" "}
              and paste the Instagram Business Account ID into the Instagram
              section.
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Pulls daily Insights from the Instagram Business Account linked
              to your Facebook Page. Re-running for the same month replaces
              the existing data.
            </div>
            <InstagramFetchButton />
          </>
        )}
      </CardContent>
    </Card>
  );

  if (!selectedUpload) {
    return (
      <>
        {fetchBar}
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">
              No Instagram months fetched yet
            </h2>
            <p className="text-sm text-muted-foreground">
              {instagramConnected
                ? "Pick a month above and click “Fetch this month.”"
                : "Add your Instagram Account ID in Settings, then come back here to fetch."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const dailyAvgViews =
    totals.dayCount > 0 ? Math.round(totals.views / totals.dayCount) : 0;
  const previousFollowerCount =
    previousMetrics.length === 0
      ? 0
      : Math.max(...previousMetrics.map((m) => m.followerCount));
  const followerDelta = totals.followerCount - previousFollowerCount;

  // Show "—" when a metric returns 0 across every day in the month — most
  // likely the API is not exposing it (permission / account-size gated) rather
  // than "actually zero". Reach is the only metric that consistently returns
  // for small accounts, so it's not subject to this treatment.
  const fmtOrDash = (n: number) => (n === 0 ? "—" : formatNumber(n));

  return (
    <>
      {fetchBar}

      <SectionHeader
        title="Instagram account metrics"
        subtitle={`Aggregated for ${selectedUpload.monthLabel}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStatCard
          icon={<Eye className="w-4 h-4" />}
          title="Views"
          value={fmtOrDash(totals.views)}
          delta={
            hasPrevious && totals.views > 0
              ? formatDelta(totals.views, previousTotals.views)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            { label: "Reach", value: formatNumber(totals.reach) },
            { label: "Daily avg", value: fmtOrDash(dailyAvgViews) },
            { label: "Active days", value: String(totals.dayCount) },
          ]}
        />
        <BigStatCard
          icon={<Heart className="w-4 h-4" />}
          title="Total interactions"
          value={fmtOrDash(totals.totalInteractions)}
          delta={
            hasPrevious && totals.totalInteractions > 0
              ? formatDelta(totals.totalInteractions, previousTotals.totalInteractions)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            { label: "Accounts engaged", value: fmtOrDash(totals.accountsEngaged) },
            { label: "Profile views", value: fmtOrDash(totals.profileViews) },
            {
              label: "Eng. rate",
              value:
                totals.views > 0
                  ? `${((totals.totalInteractions / totals.views) * 100).toFixed(2)}%`
                  : "—",
            },
          ]}
        />
        <BigStatCard
          icon={<UserPlus className="w-4 h-4" />}
          title="Followers"
          value={fmtOrDash(totals.followerCount)}
          delta={
            hasPrevious && previousFollowerCount > 0 && totals.followerCount > 0
              ? formatDelta(totals.followerCount, previousFollowerCount)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            {
              label: "Net change",
              value:
                hasPrevious && previousFollowerCount > 0 && totals.followerCount > 0
                  ? `${followerDelta >= 0 ? "+" : ""}${formatNumber(followerDelta)}`
                  : "—",
            },
            { label: "Active days", value: String(totals.dayCount) },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily reach — {selectedUpload.monthLabel}
            {previousLabel ? (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                vs {previousLabel} (dotted)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <InstagramDailyChart
              metrics={metrics}
              previousMetrics={previousMetrics}
              currentLabel={selectedUpload.monthLabel}
              previousLabel={previousLabel}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No daily rows in this fetch.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily activity — {selectedUpload.monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No daily rows in this fetch.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto themed-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium px-4 py-3">Date</th>
                    <th className="text-right font-medium px-4 py-3">Views</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Reach
                    </th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Profile views
                    </th>
                    <th className="text-right font-medium px-4 py-3">Interactions</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Followers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.date.slice(5)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNumber(m.views)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.reach)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.profileViews)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(m.totalInteractions)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.followerCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TiktokSection({
  selectedUpload,
  metrics,
  previousMetrics,
  totals,
  previousTotals,
  previousLabel,
  hasPrevious,
}: {
  selectedUpload: CompanyUploadSummary;
  metrics: TiktokDailyMetricRow[];
  previousMetrics: TiktokDailyMetricRow[];
  totals: TiktokTotals;
  previousTotals: TiktokTotals;
  previousLabel: string | null;
  hasPrevious: boolean;
}) {
  const dailyAvgViews =
    totals.dayCount > 0 ? Math.round(totals.videoViews / totals.dayCount) : 0;

  return (
    <>
      <SectionHeader
        title="TikTok page metrics"
        subtitle={`Aggregated for ${selectedUpload.monthLabel}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStatCard
          icon={<Eye className="w-4 h-4" />}
          title="Video views"
          value={formatNumber(totals.videoViews)}
          delta={
            hasPrevious
              ? formatDelta(totals.videoViews, previousTotals.videoViews)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            { label: "Daily avg", value: formatNumber(dailyAvgViews) },
            { label: "Active days", value: String(totals.dayCount) },
          ]}
        />
        <BigStatCard
          icon={<UserPlus className="w-4 h-4" />}
          title="Profile views"
          value={formatNumber(totals.profileViews)}
          delta={
            hasPrevious
              ? formatDelta(totals.profileViews, previousTotals.profileViews)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            {
              label: "Per video view",
              value:
                totals.videoViews > 0
                  ? `${((totals.profileViews / totals.videoViews) * 100).toFixed(2)}%`
                  : "—",
            },
            {
              label: "Daily avg",
              value:
                totals.dayCount > 0
                  ? formatNumber(Math.round(totals.profileViews / totals.dayCount))
                  : "—",
            },
          ]}
        />
        <BigStatCard
          icon={<Heart className="w-4 h-4" />}
          title="Engagement"
          value={formatNumber(totals.engagement)}
          delta={
            hasPrevious
              ? formatDelta(totals.engagement, previousTotals.engagement)
              : undefined
          }
          previousLabel={previousLabel}
          subStats={[
            { label: "Likes", value: formatNumber(totals.likes) },
            { label: "Comments", value: formatNumber(totals.comments) },
            { label: "Shares", value: formatNumber(totals.shares) },
            {
              label: "Eng. rate",
              value:
                totals.videoViews > 0
                  ? `${((totals.engagement / totals.videoViews) * 100).toFixed(2)}%`
                  : "—",
            },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily video views — {selectedUpload.monthLabel}
            {previousLabel ? (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                vs {previousLabel} (dotted)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <TiktokDailyChart
              metrics={metrics}
              previousMetrics={previousMetrics}
              currentLabel={selectedUpload.monthLabel}
              previousLabel={previousLabel}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No daily rows in this upload.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Daily activity — {selectedUpload.monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No daily rows in this upload.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto themed-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium px-4 py-3">Date</th>
                    <th className="text-right font-medium px-4 py-3">Video views</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Profile views
                    </th>
                    <th className="text-right font-medium px-4 py-3">Likes</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Comments
                    </th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                      Shares
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.date.slice(5)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNumber(m.videoViews)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.profileViews)}
                      </td>
                      <td className="px-4 py-3 text-right">{formatNumber(m.likes)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.comments)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {formatNumber(m.shares)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
