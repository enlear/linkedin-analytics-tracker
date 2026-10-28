import type { Dataset } from "./dataset";
import type { DateRange, DemographicEntry, IsoDate, PostMetrics } from "./linkedin/types";

// Pure, chart-ready views over a Dataset. No React, no storage — easy to test.

const DAY = 86_400_000;

export type RangeKey = "30d" | "90d" | "365d" | "all";

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "365d", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
];

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY);
}

/** Latest and earliest dates covered by any daily series. */
export function coverage(ds: Dataset): DateRange | null {
  const dates = [...ds.daily.map((d) => d.date), ...ds.followerDaily.map((d) => d.date)].sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

/** The selected window and the equally long window before it. */
export function windows(ds: Dataset, key: RangeKey): { current: DateRange; previous: DateRange | null } | null {
  const cov = coverage(ds);
  if (!cov) return null;
  const days = RANGE_OPTIONS.find((r) => r.key === key)?.days;
  if (days == null) return { current: cov, previous: null };
  const start = addDays(cov.end, -(days - 1));
  const current = { start: start < cov.start ? cov.start : start, end: cov.end };
  const prevEnd = addDays(current.start, -1);
  const previous = prevEnd >= cov.start ? { start: addDays(prevEnd, -(days - 1)), end: prevEnd } : null;
  return { current, previous };
}

const inRange = (d: IsoDate, r: DateRange) => d >= r.start && d <= r.end;

export interface Totals {
  impressions: number;
  engagements: number;
  /** Engagements per impression, 0–1. Null when there were no impressions. */
  engagementRate: number | null;
  newFollowers: number;
  postsPublished: number;
}

export function totals(ds: Dataset, r: DateRange): Totals {
  const days = ds.daily.filter((d) => inRange(d.date, r));
  const impressions = days.reduce((s, d) => s + d.impressions, 0);
  const engagements = days.reduce((s, d) => s + d.engagements, 0);
  return {
    impressions,
    engagements,
    engagementRate: impressions > 0 ? engagements / impressions : null,
    newFollowers: ds.followerDaily.filter((d) => inRange(d.date, r)).reduce((s, d) => s + d.newFollowers, 0),
    postsPublished: ds.posts.filter((p) => p.publishedOn && inRange(p.publishedOn, r)).length,
  };
}

export interface SeriesPoint {
  /** Bucket start date. */
  date: IsoDate;
  impressions: number;
  engagements: number;
}

/**
 * Daily points, rolled up into weeks (Monday start) once the window is long
 * enough that daily bars would be unreadable.
 */
export function engagementSeries(ds: Dataset, r: DateRange): { points: SeriesPoint[]; bucket: "day" | "week" } {
  const days = ds.daily.filter((d) => inRange(d.date, r));
  if (daysBetween(r.start, r.end) <= 120) return { points: days, bucket: "day" };

  const weeks = new Map<IsoDate, SeriesPoint>();
  for (const d of days) {
    const dow = (new Date(d.date).getUTCDay() + 6) % 7;
    const week = addDays(d.date, -dow);
    const w = weeks.get(week) ?? { date: week, impressions: 0, engagements: 0 };
    w.impressions += d.impressions;
    w.engagements += d.engagements;
    weeks.set(week, w);
  }
  return { points: [...weeks.values()], bucket: "week" };
}

/**
 * Follower count per day. LinkedIn gives one total ("as of" the export date)
 * plus daily gains, so the curve is anchored at the latest known total and
 * walked backwards by subtracting each day's gains.
 */
export function followerSeries(ds: Dataset, r: DateRange): { date: IsoDate; followers: number; gained: number }[] {
  const anchor = ds.followerTotals[ds.followerTotals.length - 1];
  if (!anchor) return [];
  const gains = new Map(ds.followerDaily.map((d) => [d.date, d.newFollowers]));
  const out: { date: IsoDate; followers: number; gained: number }[] = [];

  let running = anchor.total;
  for (let date = anchor.date; date >= r.start; date = addDays(date, -1)) {
    if (date <= r.end) out.push({ date, followers: running, gained: gains.get(date) ?? 0 });
    running -= gains.get(date) ?? 0;
  }
  return out.reverse();
}

export function latestFollowerTotal(ds: Dataset): { total: number; date: IsoDate } | null {
  const t = ds.followerTotals[ds.followerTotals.length - 1];
  return t ? { total: t.total, date: t.date } : null;
}

export function topPosts(
  posts: PostMetrics[],
  by: "impressions" | "engagements",
  r: DateRange | null,
  limit = 10,
): PostMetrics[] {
  return posts
    .filter((p) => p[by] != null && (!r || !p.publishedOn || inRange(p.publishedOn, r)))
    .sort((a, b) => (b[by] ?? 0) - (a[by] ?? 0))
    .slice(0, limit);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WeekdayStat {
  day: (typeof WEEKDAYS)[number];
  posts: number;
  avgImpressions: number | null;
  avgEngagements: number | null;
}

/**
 * Average performance of posts by the weekday they were published. The
 * export has publish dates but no publish times, so this is day-level only.
 */
export function weekdayPerformance(posts: PostMetrics[]): { stats: WeekdayStat[]; best: WeekdayStat | null } {
  const buckets = WEEKDAYS.map(() => ({ n: 0, imp: [] as number[], eng: [] as number[] }));
  for (const p of posts) {
    if (!p.publishedOn) continue;
    const b = buckets[(new Date(p.publishedOn).getUTCDay() + 6) % 7];
    b.n++;
    if (p.impressions != null) b.imp.push(p.impressions);
    if (p.engagements != null) b.eng.push(p.engagements);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const stats = buckets.map((b, i) => ({
    day: WEEKDAYS[i],
    posts: b.n,
    avgImpressions: avg(b.imp),
    avgEngagements: avg(b.eng),
  }));

  // Needs at least 2 posts on a day before calling it "best" — one viral post
  // shouldn't decide the recommendation.
  const metric = (s: WeekdayStat) => s.avgEngagements ?? s.avgImpressions ?? 0;
  const candidates = stats.filter((s) => s.posts >= 2);
  const best = candidates.length ? candidates.reduce((a, b) => (metric(b) > metric(a) ? b : a)) : null;
  return { stats, best };
}

export function demographicsByCategory(entries: DemographicEntry[]): { category: string; entries: DemographicEntry[] }[] {
  const groups = new Map<string, DemographicEntry[]>();
  for (const e of entries) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  return [...groups].map(([category, list]) => ({
    category,
    entries: [...list].sort((a, b) => b.share - a.share),
  }));
}
