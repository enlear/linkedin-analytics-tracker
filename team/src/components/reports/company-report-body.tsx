import { format } from "date-fns";
import { Building2, LayoutGrid, PieChart as PieIcon, TrendingUp } from "lucide-react";
import type {
  CompanyDailyMetricRow,
  CompanyPostRow,
} from "@/lib/data/company-analytics";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social-platforms";
import {
  PLATFORM_COLORS,
  REPORT_PLATFORMS,
  contentMix,
  topPosts,
  type Overview,
  type PlatformReport,
} from "@/lib/company-report";
import { formatNumber } from "@/lib/utils";
import {
  ComparisonTable,
  HBarList,
  HeadlineTile,
  KpiCell,
  SplitBar,
} from "./report-visuals";
import { DailyTrendChartLazy, ShareDonutLazy } from "./report-charts-lazy";
import { siteConfig } from "@/site.config";

export interface ReportSource {
  fileName: string;
  uploadedAt: string;
}

interface Props {
  monthLabel: string;
  prevLong: string;
  prevShort: string;
  curShort: string;
  reports: PlatformReport[];
  overview: Overview;
  /** This month's source upload per platform (absent = no data). */
  sources: Partial<Record<SocialPlatform, ReportSource>>;
  /** LinkedIn raw rows for the organic/sponsored, content-mix and top-post visuals. */
  linkedin: { metrics: CompanyDailyMetricRow[]; posts: CompanyPostRow[] } | null;
}

/**
 * The company monthly report, from header to footer. Pure presentation — the
 * page does the fetching — so it can also be rendered with sample data.
 */
export function CompanyReportBody({
  monthLabel,
  prevLong,
  prevShort,
  curShort,
  reports,
  overview,
  sources,
  linkedin,
}: Props) {
  return (
    <div className="report-page space-y-8 print:space-y-5">
      {/* Header */}
      <header className="space-y-3 border-b border-border pb-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          {siteConfig.name} — Company Analytics Report
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{monthLabel}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All platforms, compared with {prevLong}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REPORT_PLATFORMS.map((p) => {
              const src = sources[p];
              return (
                <span
                  key={p}
                  className={
                    src
                      ? "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                      : "inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
                  }
                  title={src ? `Source: ${src.fileName}` : "No data for this month"}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: src ? PLATFORM_COLORS[p] : "hsl(var(--muted))" }}
                  />
                  {PLATFORM_LABELS[p]}
                  {!src ? " · no data" : null}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* Cross-platform overview */}
      <section className="space-y-4">
        <SectionTitle icon={LayoutGrid} title="Overview" sub={`All platforms · vs ${prevLong}`} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeadlineTile
            label="Total views"
            value={formatNumber(overview.views.current)}
            change={overview.views.change}
            sub={`vs ${prevShort}`}
          />
          <HeadlineTile
            label="Total engagements"
            value={formatNumber(overview.engagements.current)}
            change={overview.engagements.change}
            sub={`vs ${prevShort}`}
          />
          <HeadlineTile
            label="Total reach"
            value={formatNumber(overview.reach.current)}
            change={overview.reach.change}
            sub={`vs ${prevShort}`}
          />
          <HeadlineTile
            label="Engagement rate"
            value={`${(overview.engagementRate.current * 100).toFixed(2)}%`}
            change={overview.engagementRate.change}
            sub="engagements ÷ views"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Share of views" icon={PieIcon}>
            <ShareDonutLazy
              data={reports.map((r) => ({ label: r.label, value: r.views.current, color: r.color }))}
              centerValue={formatNumber(overview.views.current)}
              centerLabel="views"
            />
          </ChartCard>
          <ChartCard title="Share of engagements" icon={PieIcon}>
            <ShareDonutLazy
              data={reports.map((r) => ({
                label: r.label,
                value: r.engagements.current,
                color: r.color,
              }))}
              centerValue={formatNumber(overview.engagements.current)}
              centerLabel="engagements"
            />
          </ChartCard>
        </div>

        <ComparisonTable reports={reports} prevLabel={prevShort} />
        {overview.comparedPlatforms < overview.totalPlatforms ? (
          <p className="text-xs text-muted-foreground">
            Changes compare like with like — only the {overview.comparedPlatforms} of{" "}
            {overview.totalPlatforms} platforms that also reported in {prevLong}.
          </p>
        ) : null}
      </section>

      {/* One section per platform */}
      {reports.map((r) => (
        <PlatformSection
          key={r.platform}
          report={r}
          source={sources[r.platform]}
          prevShort={prevShort}
          curShort={curShort}
          linkedin={r.platform === "linkedin" ? linkedin : null}
        />
      ))}

      <footer className="text-xs text-muted-foreground border-t border-border pt-3">
        Generated {format(new Date(), "MMM d, yyyy 'at' h:mm a")} · Daily figures are on the
        Company analytics page.
      </footer>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </h2>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 print:break-inside-avoid">
      <div className="text-sm font-medium flex items-center gap-2 mb-3">
        {Icon ? <Icon className="w-4 h-4 text-muted-foreground" /> : null}
        {title}
      </div>
      {children}
    </div>
  );
}

function PlatformSection({
  report,
  source,
  prevShort,
  curShort,
  linkedin,
}: {
  report: PlatformReport;
  source: ReportSource | undefined;
  prevShort: string;
  curShort: string;
  linkedin: { metrics: CompanyDailyMetricRow[]; posts: CompanyPostRow[] } | null;
}) {
  const organic = linkedin
    ? linkedin.metrics.reduce((s, x) => s + (x.impressionsOrganic || 0), 0)
    : 0;
  const sponsored = linkedin
    ? linkedin.metrics.reduce((s, x) => s + (x.impressionsSponsored || 0), 0)
    : 0;
  const mix = linkedin ? contentMix(linkedin.posts) : [];
  const best = linkedin ? topPosts(linkedin.posts, 5) : [];

  return (
    <section className="space-y-4 print:break-before-page">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-xl font-semibold flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full" style={{ background: report.color }} />
          {report.label}
        </h2>
        <span className="text-xs text-muted-foreground">
          {source
            ? `Source: ${source.fileName} · ${format(new Date(source.uploadedAt), "MMM d, yyyy")}`
            : null}
          {report.hasPrevious ? ` · vs ${prevShort}` : " · no data last month"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {report.kpis.map((k) => (
          <KpiCell key={k.label} kpi={k} prevLabel={prevShort} />
        ))}
      </div>

      <ChartCard
        title={`Daily ${report.dailyLabel.toLowerCase()} — ${curShort} vs ${prevShort}`}
        icon={TrendingUp}
      >
        <DailyTrendChartLazy
          data={report.daily}
          color={report.color}
          metricLabel={report.dailyLabel}
          currentLabel={curShort}
          previousLabel={`${prevShort} (same day)`}
        />
      </ChartCard>

      {linkedin ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Organic vs sponsored impressions">
            {organic + sponsored > 0 ? (
              <SplitBar
                parts={[
                  { label: "Organic", value: organic, color: report.color },
                  { label: "Sponsored", value: sponsored, color: "#f59e0b" },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No organic / sponsored split in this export.
              </p>
            )}
          </ChartCard>
          <ChartCard title="Content mix">
            {mix.length ? (
              <HBarList
                items={mix.map((c) => ({ label: c.label, value: c.value }))}
                color={report.color}
                valueLabel={(v) => `${v} ${v === 1 ? "post" : "posts"}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No posts in this export.</p>
            )}
          </ChartCard>
          <ChartCard title="Top posts by impressions">
            {best.length ? (
              <HBarList
                items={best.map((p) => ({
                  label: p.postTitle ?? "Untitled post",
                  value: p.impressions,
                  sub: `${(p.engagementRate * 100).toFixed(1)}% eng. · ${formatNumber(p.clicks)} clicks${
                    p.createdDate
                      ? ` · ${format(new Date(p.createdDate + "T00:00:00"), "MMM d")}`
                      : ""
                  }`,
                }))}
                color={report.color}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No posts in this export.</p>
            )}
          </ChartCard>
        </div>
      ) : null}
    </section>
  );
}
