import type {
  DailyRowInput,
  InstagramDailyMetricRecord,
} from "@/lib/supabase/database.types";
import {
  dateForEndTime,
  fetchInsights,
  valueAsNumber,
  type InsightsQuery,
  type InsightValue,
  type ReportMonth,
} from "./graph";

// Instagram v22+ split metrics into two response formats:
//   - DAILY_METRICS: returned as a time-series array (`values: [{ value, end_time }]`).
//   - TOTAL_VALUE_METRICS: returned as a single period total (`total_value: { value }`)
//     and require an explicit `metric_type=total_value` query parameter.
//
// `follower_count` is a daily snapshot (period=day) on v22+ — the older
// `period=lifetime` no longer works.
export const INSTAGRAM_DAILY_METRICS = ["reach", "profile_views", "follower_count"] as const;

export const INSTAGRAM_TOTAL_VALUE_METRICS = [
  "views",
  "accounts_engaged",
  "total_interactions",
] as const;

export interface InstagramInsight {
  name: string;
  period: string;
  // Either a daily time-series ...
  values?: InsightValue[];
  // ... OR a single period total (v22+ aggregate metrics).
  total_value?: { value: InsightValue["value"] };
}

export type InstagramDailyRow = DailyRowInput<InstagramDailyMetricRecord>;

// Instagram Insights API caps the since→until window at 30 days. Months with
// 31 days (Jan, Mar, May, Jul, Aug, Oct, Dec) need to be split. We use 29-day
// chunks for safety margin — daily-metric duplicates across chunk boundaries
// are dedup'd later by date in buildInstagramDailyRows.
const CHUNK_MAX_SECONDS = 29 * 86400;

export function chunkRange(start: number, end: number): Array<{ since: number; until: number }> {
  const chunks: Array<{ since: number; until: number }> = [];
  let s = start;
  while (s < end) {
    const u = Math.min(s + CHUNK_MAX_SECONDS, end);
    chunks.push({ since: s, until: u });
    s = u;
  }
  return chunks;
}

/** Insights for the month, chunk by chunk. Throws only when every request fails. */
export function fetchInstagramAccountInsights(
  igUserId: string,
  accessToken: string,
  month: Pick<ReportMonth, "since" | "until">,
): Promise<InstagramInsight[]> {
  const queries: InsightsQuery[] = chunkRange(month.since, month.until).flatMap((chunk) => {
    const since = String(chunk.since);
    const until = String(chunk.until);
    return [
      ...INSTAGRAM_DAILY_METRICS.map((metric) => ({ metric, period: "day", since, until })),
      ...INSTAGRAM_TOTAL_VALUE_METRICS.map((metric) => ({
        metric,
        period: "day",
        since,
        until,
        // v22+ aggregate metrics — single period total, requires this param.
        metric_type: "total_value",
      })),
    ];
  });
  return fetchInsights<InstagramInsight>(igUserId, accessToken, queries, "ig-insights");
}

function emptyRow(date: string): InstagramDailyRow {
  return {
    date,
    reach: 0,
    views: 0,
    profile_views: 0,
    accounts_engaged: 0,
    total_interactions: 0,
    follower_count: 0,
  };
}

export function buildInstagramDailyRows(
  insights: InstagramInsight[],
  reportMonth: string,
): InstagramDailyRow[] {
  const monthPrefix = reportMonth.slice(0, 7); // "YYYY-MM"
  const byDate = new Map<string, InstagramDailyRow>();

  // First pass — daily time series (reach, profile_views, follower_count).
  for (const metric of insights) {
    if (!metric.values?.length) continue;
    for (const point of metric.values) {
      const date = dateForEndTime(point.end_time);
      if (!date.startsWith(monthPrefix)) continue;
      const existing = byDate.get(date) ?? emptyRow(date);
      const n = valueAsNumber(point.value);
      switch (metric.name) {
        case "reach":
          existing.reach = n;
          break;
        case "profile_views":
          existing.profile_views = n;
          break;
        case "follower_count":
          existing.follower_count = n;
          break;
      }
      byDate.set(date, existing);
    }
  }

  // Second pass — period totals (views, accounts_engaged, total_interactions).
  // These come back as a single number for the whole period. We stash the
  // total on the FIRST day of the data window so the UI's sum-across-days
  // logic yields the same period total. (The chart for these would look like
  // a spike on day 1, so we chart `reach` instead — that has real daily data.)
  // A 31-day month arrives as two chunk totals, so they add up rather than
  // the second replacing the first. accounts_engaged counts unique accounts,
  // so someone engaging in both chunks is counted twice; Graph offers no
  // month-wide figure to do better.
  const firstDate = [...byDate.keys()].sort()[0] ?? `${monthPrefix}-01`;
  for (const metric of insights) {
    if (metric.total_value == null) continue;
    const n = valueAsNumber(metric.total_value.value);
    const row = byDate.get(firstDate) ?? emptyRow(firstDate);
    switch (metric.name) {
      case "views":
        row.views += n;
        break;
      case "accounts_engaged":
        row.accounts_engaged += n;
        break;
      case "total_interactions":
        row.total_interactions += n;
        break;
    }
    byDate.set(firstDate, row);
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
