import * as XLSX from "xlsx";

// Synthetic company-page exports, built in code: real exports are private
// and never committed. Numbers are made up; links use example ids.

export type Row = Record<string, unknown>;
type Grid = unknown[][];

export const METRICS_HEADERS = [
  "Date",
  "Impressions (organic)",
  "Impressions (sponsored)",
  "Impressions (total)",
  "Unique impressions (organic)",
  "Clicks (organic)",
  "Clicks (sponsored)",
  "Clicks (total)",
  "Reactions (organic)",
  "Reactions (sponsored)",
  "Reactions (total)",
  "Comments (organic)",
  "Comments (sponsored)",
  "Comments (total)",
  "Reposts (organic)",
  "Reposts (sponsored)",
  "Reposts (total)",
  "Engagement rate (organic)",
  "Engagement rate (sponsored)",
  "Engagement rate (total)",
];

export const POST_HEADERS = [
  "Post title",
  "Post link",
  "Post type",
  "Campaign name",
  "Posted by",
  "Created date",
  "Audience",
  "Impressions",
  "Views",
  "Offsite Views",
  "Clicks",
  "Click through rate (CTR)",
  "Likes",
  "Comments",
  "Reposts",
  "Follows",
  "Engagement rate",
  "Content Type",
];

export const TIKTOK_HEADERS = ["Date", "Video Views", "Profile Views", "Likes", "Comments", "Shares"];

export const MAY_METRICS: Row[] = [
  {
    Date: "05/01/2026",
    "Impressions (organic)": 120,
    "Impressions (sponsored)": 30,
    "Impressions (total)": 150,
    "Unique impressions (organic)": 90,
    "Clicks (organic)": 6,
    "Clicks (sponsored)": 2,
    "Clicks (total)": 8,
    "Reactions (organic)": 10,
    "Reactions (sponsored)": 1,
    "Reactions (total)": 11,
    "Comments (organic)": 2,
    "Comments (sponsored)": 0,
    "Comments (total)": 2,
    "Reposts (organic)": 1,
    "Reposts (sponsored)": 0,
    "Reposts (total)": 1,
    "Engagement rate (organic)": 0.158,
    "Engagement rate (sponsored)": 0.1,
    "Engagement rate (total)": 0.147,
  },
  {
    Date: "05/02/2026",
    "Impressions (organic)": 80,
    "Impressions (sponsored)": 0,
    "Impressions (total)": 80,
    "Unique impressions (organic)": 61,
    "Clicks (organic)": 3,
    "Clicks (sponsored)": 0,
    "Clicks (total)": 3,
    "Reactions (organic)": 4,
    "Reactions (sponsored)": 0,
    "Reactions (total)": 4,
    "Comments (organic)": 0,
    "Comments (sponsored)": 0,
    "Comments (total)": 0,
    "Reposts (organic)": 0,
    "Reposts (sponsored)": 0,
    "Reposts (total)": 0,
    "Engagement rate (organic)": 0.0875,
    "Engagement rate (sponsored)": 0,
    "Engagement rate (total)": 0.0875,
  },
];

export const MAY_POSTS: Row[] = [
  {
    "Post title": "  Launch day at Example Co  ",
    "Post link": "https://www.linkedin.com/feed/update/urn:li:activity:2001",
    "Post type": "Organic",
    "Campaign name": null,
    "Posted by": "Example Admin",
    "Created date": "05/04/2026",
    Audience: "All followers",
    Impressions: 900,
    Views: null,
    "Offsite Views": null,
    Clicks: 40,
    "Click through rate (CTR)": 0.0444,
    Likes: 25,
    Comments: 3,
    Reposts: 2,
    Follows: 1,
    "Engagement rate": 0.0778,
    "Content Type": "Image",
  },
  {
    "Post title": null,
    "Post link": "https://www.linkedin.com/feed/update/urn:li:activity:2002",
    "Post type": "Sponsored",
    "Campaign name": "Example campaign",
    "Posted by": null,
    "Created date": "05/10/2026",
    Audience: "Targeted",
    Impressions: 300.4,
    Views: 120,
    "Offsite Views": 5,
    Clicks: 12,
    "Click through rate (CTR)": 0.04,
    Likes: 6,
    Comments: 0,
    Reposts: 0,
    Follows: 0,
    "Engagement rate": 0.06,
    "Content Type": "Video",
  },
];

export const APRIL_OVERVIEW: Row[] = [
  { Date: "April 1", "Video Views": 1200, "Profile Views": 40, Likes: 95, Comments: 7, Shares: 3 },
  { Date: "April 2", "Video Views": 860, "Profile Views": 22, Likes: 51, Comments: 2, Shares: 0 },
  { Date: "April 3", "Video Views": 1310, "Profile Views": 35, Likes: 102, Comments: 9, Shares: 4 },
];

/** Header row, then one row per record, columns in `headers` order. */
export function table(headers: string[], rows: Row[]): Grid {
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? null))];
}

/** LinkedIn's layout: a descriptive title row above the table. */
export function titledTable(title: string, headers: string[], rows: Row[]): Grid {
  return [[title], ...table(headers, rows)];
}

export function workbookBytes(sheets: Record<string, Grid>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, grid] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid, { cellDates: true }), name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function linkedinCompanyExport({
  metrics = MAY_METRICS,
  posts = MAY_POSTS,
  metricsHeaders = METRICS_HEADERS,
}: { metrics?: Row[]; posts?: Row[]; metricsHeaders?: string[] } = {}): ArrayBuffer {
  return workbookBytes({
    Metrics: titledTable("Aggregated metrics for Example Co, May 1, 2026 - May 31, 2026", metricsHeaders, metrics),
    "All posts": titledTable("All posts for Example Co, May 1, 2026 - May 31, 2026", POST_HEADERS, posts),
  });
}

export function tiktokExport(rows: Row[] = APRIL_OVERVIEW, sheetName = "Overview"): ArrayBuffer {
  return workbookBytes({ [sheetName]: table(TIKTOK_HEADERS, rows) });
}
