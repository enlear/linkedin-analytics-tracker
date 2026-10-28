import type {
  DailyRowInput,
  FacebookDailyMetricRecord,
} from "@/lib/supabase/database.types";
import {
  dateForEndTime,
  fetchInsights,
  valueAsNumber,
  type InsightValue,
  type ReportMonth,
} from "./graph";

// Page-level daily metrics. Meta has aggressively deprecated old page-level
// metrics since v20 — `page_impressions`, `page_engaged_users`, `page_fan_adds`
// etc. are all gone. We use the post-impression variants + the few page-level
// metrics that survived.
export const FACEBOOK_METRICS = [
  "page_post_impressions",          // total impressions on the page's posts
  "page_post_impressions_unique",   // unique users reached by posts
  "page_total_actions",             // CTA / page-level action clicks
  "page_follows",                   // new follows (replaces page_fan_adds)
  "page_post_engagements",          // engagements on posts
  "page_views_total",               // total page views (extra signal)
] as const;

export interface FacebookInsight {
  name: string;
  period: string;
  values: InsightValue[];
}

export type FacebookDailyRow = DailyRowInput<FacebookDailyMetricRecord>;

/** Daily Page insights for the month. Throws only when every metric fails. */
export function fetchFacebookPageInsights(
  pageId: string,
  accessToken: string,
  month: Pick<ReportMonth, "since" | "until">,
): Promise<FacebookInsight[]> {
  const since = String(month.since);
  const until = String(month.until);
  return fetchInsights<FacebookInsight>(
    pageId,
    accessToken,
    FACEBOOK_METRICS.map((metric) => ({ metric, period: "day", since, until })),
    "fb-insights",
  );
}

function emptyRow(date: string): FacebookDailyRow {
  return {
    date,
    impressions: 0,
    reach: 0,
    engaged_users: 0,
    new_followers: 0,
    post_impressions: 0,
    post_engagements: 0,
  };
}

export function buildFacebookDailyRows(
  insights: FacebookInsight[],
  reportMonth: string,
): FacebookDailyRow[] {
  // reportMonth = "YYYY-MM-01" — filter to only rows in this month. Graph
  // API's end_time scheme means a since=May-1 query returns April-30's data
  // as the first row; without this filter we'd leak it into May's totals.
  const monthPrefix = reportMonth.slice(0, 7);
  const byDate = new Map<string, FacebookDailyRow>();
  for (const metric of insights) {
    for (const point of metric.values) {
      const date = dateForEndTime(point.end_time);
      if (!date.startsWith(monthPrefix)) continue;
      const existing = byDate.get(date) ?? emptyRow(date);
      const n = valueAsNumber(point.value);
      // The column names predate Meta's metric renames, so they no longer
      // match their sources one-to-one:
      //   impressions       <- page_post_impressions  (was page_impressions)
      //   reach             <- page_post_impressions_unique (was page_impressions_unique)
      //   engaged_users     <- page_total_actions     (was page_engaged_users)
      //   new_followers     <- page_follows           (was page_fan_adds)
      //   post_impressions  <- page_views_total       (extra signal — total page views)
      //   post_engagements  <- page_post_engagements  (unchanged)
      switch (metric.name) {
        case "page_post_impressions":
          existing.impressions = n;
          break;
        case "page_post_impressions_unique":
          existing.reach = n;
          break;
        case "page_total_actions":
          existing.engaged_users = n;
          break;
        case "page_follows":
          existing.new_followers = n;
          break;
        case "page_views_total":
          existing.post_impressions = n;
          break;
        case "page_post_engagements":
          existing.post_engagements = n;
          break;
      }
      byDate.set(date, existing);
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
