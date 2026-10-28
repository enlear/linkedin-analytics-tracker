// Pure builders for the company monthly report. Each platform's raw rows are
// folded into one comparable shape (views / engagements / reach + a KPI list +
// a day-by-day trend), for the report month AND the month before it, so the
// page can compare like with like across all four platforms.

import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social-platforms";
import type {
  CompanyDailyMetricRow,
  CompanyPostRow,
  FacebookDailyMetricRow,
  InstagramDailyMetricRow,
  TiktokDailyMetricRow,
} from "@/lib/data/company-analytics";

/**
 * One colour per platform, used by every chart in the report. Chosen for
 * separation from each other (blue / teal / violet / pink) rather than brand
 * fidelity — Facebook's and LinkedIn's brand blues are nearly identical.
 * Colour never carries meaning alone: every chart labels its platforms.
 */
export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  linkedin: "#0a66c2",
  tiktok: "#0d9488",
  facebook: "#7c3aed",
  instagram: "#db2777",
};

export const REPORT_PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram", "tiktok"];

export interface Kpi {
  label: string;
  value: number;
  previous: number | null;
  format?: "number" | "percent";
}

export interface DailyPoint {
  day: number;
  current: number | null;
  previous: number | null;
}

export interface Measure {
  current: number;
  previous: number | null;
}

export interface PlatformReport {
  platform: SocialPlatform;
  label: string;
  color: string;
  hasPrevious: boolean;
  /** Headline exposure metric — named per platform (impressions / views). */
  viewsLabel: string;
  views: Measure;
  engagements: Measure;
  /** Unique people reached; null where the platform export has no such metric. */
  reach: Measure | null;
  kpis: Kpi[];
  dailyLabel: string;
  daily: DailyPoint[];
}

/** Percentage change, or null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((a, r) => a + (pick(r) || 0), 0);
}

function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

function dailySeries<T extends { date: string }>(
  current: T[],
  previous: T[] | null,
  pick: (r: T) => number,
  daysInMonth: number,
): DailyPoint[] {
  const cur = new Map<number, number>();
  for (const r of current) cur.set(dayOf(r.date), (cur.get(dayOf(r.date)) ?? 0) + pick(r));
  const prev = new Map<number, number>();
  for (const r of previous ?? []) prev.set(dayOf(r.date), (prev.get(dayOf(r.date)) ?? 0) + pick(r));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      day,
      current: cur.has(day) ? cur.get(day)! : null,
      previous: previous ? (prev.has(day) ? prev.get(day)! : null) : null,
    };
  });
}

function kpi(
  label: string,
  current: number,
  previous: number | null,
  format: Kpi["format"] = "number",
): Kpi {
  return { label, value: current, previous, format };
}

// ---------------------------------------------------------------------------
// Per-platform builders
// ---------------------------------------------------------------------------

export function linkedinReport(
  cur: { metrics: CompanyDailyMetricRow[]; posts: CompanyPostRow[] },
  prev: { metrics: CompanyDailyMetricRow[]; posts: CompanyPostRow[] } | null,
  daysInMonth: number,
): PlatformReport {
  const eng = (m: CompanyDailyMetricRow[]) =>
    sum(m, (r) => r.reactions + r.comments + r.reposts);
  const avgRate = (m: CompanyDailyMetricRow[]) =>
    m.length ? sum(m, (r) => r.engagementRate) / m.length : 0;
  const p = prev;
  return {
    platform: "linkedin",
    label: PLATFORM_LABELS.linkedin,
    color: PLATFORM_COLORS.linkedin,
    hasPrevious: p != null,
    viewsLabel: "Impressions",
    views: { current: sum(cur.metrics, (r) => r.impressions), previous: p ? sum(p.metrics, (r) => r.impressions) : null },
    engagements: { current: eng(cur.metrics), previous: p ? eng(p.metrics) : null },
    reach: {
      current: sum(cur.metrics, (r) => r.uniqueImpressions),
      previous: p ? sum(p.metrics, (r) => r.uniqueImpressions) : null,
    },
    kpis: [
      kpi("Impressions", sum(cur.metrics, (r) => r.impressions), p ? sum(p.metrics, (r) => r.impressions) : null),
      kpi("Unique impressions", sum(cur.metrics, (r) => r.uniqueImpressions), p ? sum(p.metrics, (r) => r.uniqueImpressions) : null),
      kpi("Clicks", sum(cur.metrics, (r) => r.clicks), p ? sum(p.metrics, (r) => r.clicks) : null),
      kpi("Engagements", eng(cur.metrics), p ? eng(p.metrics) : null),
      kpi("Avg engagement rate", avgRate(cur.metrics), p ? avgRate(p.metrics) : null, "percent"),
      kpi("Posts", cur.posts.length, p ? p.posts.length : null),
      kpi("Follows from posts", sum(cur.posts, (r) => r.follows), p ? sum(p.posts, (r) => r.follows) : null),
      kpi("Post likes", sum(cur.posts, (r) => r.likes), p ? sum(p.posts, (r) => r.likes) : null),
    ],
    dailyLabel: "Impressions",
    daily: dailySeries(cur.metrics, p?.metrics ?? null, (r) => r.impressions, daysInMonth),
  };
}

export function tiktokReport(
  cur: TiktokDailyMetricRow[],
  prev: TiktokDailyMetricRow[] | null,
  daysInMonth: number,
): PlatformReport {
  const eng = (m: TiktokDailyMetricRow[]) => sum(m, (r) => r.likes + r.comments + r.shares);
  const views = (m: TiktokDailyMetricRow[]) => sum(m, (r) => r.videoViews);
  const rate = (m: TiktokDailyMetricRow[]) => (views(m) > 0 ? eng(m) / views(m) : 0);
  return {
    platform: "tiktok",
    label: PLATFORM_LABELS.tiktok,
    color: PLATFORM_COLORS.tiktok,
    hasPrevious: prev != null,
    viewsLabel: "Video views",
    views: { current: views(cur), previous: prev ? views(prev) : null },
    engagements: { current: eng(cur), previous: prev ? eng(prev) : null },
    reach: null,
    kpis: [
      kpi("Video views", views(cur), prev ? views(prev) : null),
      kpi("Profile views", sum(cur, (r) => r.profileViews), prev ? sum(prev, (r) => r.profileViews) : null),
      kpi("Likes", sum(cur, (r) => r.likes), prev ? sum(prev, (r) => r.likes) : null),
      kpi("Comments", sum(cur, (r) => r.comments), prev ? sum(prev, (r) => r.comments) : null),
      kpi("Shares", sum(cur, (r) => r.shares), prev ? sum(prev, (r) => r.shares) : null),
      kpi("Engagement rate", rate(cur), prev ? rate(prev) : null, "percent"),
    ],
    dailyLabel: "Video views",
    daily: dailySeries(cur, prev, (r) => r.videoViews, daysInMonth),
  };
}

export function facebookReport(
  cur: FacebookDailyMetricRow[],
  prev: FacebookDailyMetricRow[] | null,
  daysInMonth: number,
): PlatformReport {
  const f = (m: FacebookDailyMetricRow[] | null, pick: (r: FacebookDailyMetricRow) => number) =>
    m ? sum(m, pick) : null;
  return {
    platform: "facebook",
    label: PLATFORM_LABELS.facebook,
    color: PLATFORM_COLORS.facebook,
    hasPrevious: prev != null,
    viewsLabel: "Impressions",
    views: { current: sum(cur, (r) => r.impressions), previous: f(prev, (r) => r.impressions) },
    engagements: { current: sum(cur, (r) => r.postEngagements), previous: f(prev, (r) => r.postEngagements) },
    reach: { current: sum(cur, (r) => r.reach), previous: f(prev, (r) => r.reach) },
    kpis: [
      kpi("Impressions", sum(cur, (r) => r.impressions), f(prev, (r) => r.impressions)),
      kpi("Reach", sum(cur, (r) => r.reach), f(prev, (r) => r.reach)),
      kpi("Post engagements", sum(cur, (r) => r.postEngagements), f(prev, (r) => r.postEngagements)),
      kpi("Page actions", sum(cur, (r) => r.engagedUsers), f(prev, (r) => r.engagedUsers)),
      kpi("New follows", sum(cur, (r) => r.newFollowers), f(prev, (r) => r.newFollowers)),
      kpi("Page views", sum(cur, (r) => r.postImpressions), f(prev, (r) => r.postImpressions)),
    ],
    dailyLabel: "Impressions",
    daily: dailySeries(cur, prev, (r) => r.impressions, daysInMonth),
  };
}

export function instagramReport(
  cur: InstagramDailyMetricRow[],
  prev: InstagramDailyMetricRow[] | null,
  daysInMonth: number,
): PlatformReport {
  const f = (m: InstagramDailyMetricRow[] | null, pick: (r: InstagramDailyMetricRow) => number) =>
    m ? sum(m, pick) : null;
  // followerCount is a daily cumulative snapshot — take the last day's value,
  // never a sum.
  const lastFollowers = (m: InstagramDailyMetricRow[] | null) => {
    if (!m || m.length === 0) return null;
    const sorted = [...m].sort((a, b) => (a.date < b.date ? -1 : 1));
    return sorted[sorted.length - 1].followerCount;
  };
  return {
    platform: "instagram",
    label: PLATFORM_LABELS.instagram,
    color: PLATFORM_COLORS.instagram,
    hasPrevious: prev != null,
    viewsLabel: "Views",
    views: { current: sum(cur, (r) => r.views), previous: f(prev, (r) => r.views) },
    engagements: { current: sum(cur, (r) => r.totalInteractions), previous: f(prev, (r) => r.totalInteractions) },
    reach: { current: sum(cur, (r) => r.reach), previous: f(prev, (r) => r.reach) },
    kpis: [
      kpi("Views", sum(cur, (r) => r.views), f(prev, (r) => r.views)),
      kpi("Reach", sum(cur, (r) => r.reach), f(prev, (r) => r.reach)),
      kpi("Interactions", sum(cur, (r) => r.totalInteractions), f(prev, (r) => r.totalInteractions)),
      kpi("Accounts engaged", sum(cur, (r) => r.accountsEngaged), f(prev, (r) => r.accountsEngaged)),
      kpi("Profile views", sum(cur, (r) => r.profileViews), f(prev, (r) => r.profileViews)),
      kpi("Followers (month end)", lastFollowers(cur) ?? 0, lastFollowers(prev)),
    ],
    dailyLabel: "Views",
    daily: dailySeries(cur, prev, (r) => r.views, daysInMonth),
  };
}

// ---------------------------------------------------------------------------
// Cross-platform roll-up
// ---------------------------------------------------------------------------

export interface OverviewMetric {
  /** Total across every platform that reported this month. */
  current: number;
  /** Like-for-like % change vs last month (see buildOverview); null = no baseline. */
  change: number | null;
}

export interface Overview {
  views: OverviewMetric;
  engagements: OverviewMetric;
  reach: OverviewMetric;
  engagementRate: OverviewMetric;
  /** Platforms with data in both months — the basis for every change figure. */
  comparedPlatforms: number;
  totalPlatforms: number;
}

/**
 * Cross-platform totals. The % change is like-for-like: it only uses platforms
 * that reported in BOTH months, so a platform connected this month can't show
 * up as growth.
 */
export function buildOverview(reports: PlatformReport[]): Overview {
  const both = reports.filter((r) => r.hasPrevious);
  const total = (pick: (r: PlatformReport) => number) => sum(reports, pick);
  const like = (pick: (r: PlatformReport) => number) => sum(both, pick);
  const change = (current: number, previous: number) =>
    both.length ? pctChange(current, previous) : null;

  const views = total((r) => r.views.current);
  const eng = total((r) => r.engagements.current);
  const likeViews = like((r) => r.views.current);
  const likeEng = like((r) => r.engagements.current);
  const prevViews = like((r) => r.views.previous ?? 0);
  const prevEng = like((r) => r.engagements.previous ?? 0);
  const rateLike = likeViews > 0 ? likeEng / likeViews : 0;
  const ratePrev = prevViews > 0 ? prevEng / prevViews : 0;

  return {
    views: { current: views, change: change(likeViews, prevViews) },
    engagements: { current: eng, change: change(likeEng, prevEng) },
    reach: {
      current: total((r) => r.reach?.current ?? 0),
      change: change(like((r) => r.reach?.current ?? 0), like((r) => r.reach?.previous ?? 0)),
    },
    engagementRate: {
      current: views > 0 ? eng / views : 0,
      change: ratePrev > 0 ? change(rateLike, ratePrev) : null,
    },
    comparedPlatforms: both.length,
    totalPlatforms: reports.length,
  };
}

// ---------------------------------------------------------------------------
// LinkedIn extras
// ---------------------------------------------------------------------------

export function contentMix(posts: CompanyPostRow[]): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  for (const p of posts) {
    const key = p.contentType ?? p.postType ?? "Other";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function topPosts(posts: CompanyPostRow[], n = 5): CompanyPostRow[] {
  return [...posts].sort((a, b) => b.impressions - a.impressions).slice(0, n);
}
