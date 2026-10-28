import type {
  CompanyDailyMetricRecord,
  CompanyPostRecord,
  DailyRowInput,
} from "@/lib/supabase/database.types";
import { CompanyImportError, intNum, num, parseDateCell, parseWorkbook, readSheet, textOrNull } from "./shared";

// Parser for the LinkedIn company page export (Page analytics → Export): a
// "Metrics" sheet of daily totals with organic/sponsored splits, and an
// "All posts" sheet. Both start with a descriptive title row, so the headers
// are on the second row.

export type LinkedInDailyRow = DailyRowInput<CompanyDailyMetricRecord>;
export type LinkedInPostRow = DailyRowInput<CompanyPostRecord>;

export interface LinkedInCompanyImport {
  daily: LinkedInDailyRow[];
  posts: LinkedInPostRow[];
}

/** Throws CompanyImportError. */
export function parseLinkedInCompanyExport(data: ArrayBuffer): LinkedInCompanyImport {
  const result = parseWorkbook(data, (wb) => ({
    daily: parseMetricsSheet(readSheet(wb, "Metrics", { headerRow: 1 })),
    posts: parsePostsSheet(readSheet(wb, "All posts", { headerRow: 1 })),
  }));
  if (result.daily.length === 0 && result.posts.length === 0) {
    throw new CompanyImportError(
      "empty_file",
      "No data rows found in either sheet. Make sure the xlsx has 'Metrics' and 'All posts' tabs.",
    );
  }
  return result;
}

// Older exports have no "(total)" columns, and a 0 there can mean "not filled
// in", so fall back to organic + sponsored.
function totalOr(total: unknown, organic: number, sponsored: number): number {
  const t = intNum(total);
  return t > 0 ? t : organic + sponsored;
}

function parseMetricsSheet(rows: Record<string, unknown>[]): LinkedInDailyRow[] {
  return rows.flatMap((row): LinkedInDailyRow[] => {
    const date = parseDateCell(row["Date"]);
    if (!date) return [];
    const impressionsOrganic = intNum(row["Impressions (organic)"]);
    const impressionsSponsored = intNum(row["Impressions (sponsored)"]);
    const clicksOrganic = intNum(row["Clicks (organic)"]);
    const clicksSponsored = intNum(row["Clicks (sponsored)"]);
    const reactionsOrganic = intNum(row["Reactions (organic)"]);
    const reactionsSponsored = intNum(row["Reactions (sponsored)"]);
    const commentsOrganic = intNum(row["Comments (organic)"]);
    const commentsSponsored = intNum(row["Comments (sponsored)"]);
    const repostsOrganic = intNum(row["Reposts (organic)"]);
    const repostsSponsored = intNum(row["Reposts (sponsored)"]);
    return [
      {
        date,
        impressions: totalOr(row["Impressions (total)"], impressionsOrganic, impressionsSponsored),
        impressions_organic: impressionsOrganic,
        impressions_sponsored: impressionsSponsored,
        unique_impressions: intNum(row["Unique impressions (organic)"]),
        clicks: totalOr(row["Clicks (total)"], clicksOrganic, clicksSponsored),
        clicks_organic: clicksOrganic,
        clicks_sponsored: clicksSponsored,
        reactions: totalOr(row["Reactions (total)"], reactionsOrganic, reactionsSponsored),
        reactions_organic: reactionsOrganic,
        reactions_sponsored: reactionsSponsored,
        comments: totalOr(row["Comments (total)"], commentsOrganic, commentsSponsored),
        comments_organic: commentsOrganic,
        comments_sponsored: commentsSponsored,
        reposts: totalOr(row["Reposts (total)"], repostsOrganic, repostsSponsored),
        reposts_organic: repostsOrganic,
        reposts_sponsored: repostsSponsored,
        engagement_rate: num(row["Engagement rate (total)"] ?? row["Engagement rate (organic)"]),
        engagement_rate_organic: num(row["Engagement rate (organic)"]),
        engagement_rate_sponsored: num(row["Engagement rate (sponsored)"]),
      },
    ];
  });
}

function parsePostsSheet(rows: Record<string, unknown>[]): LinkedInPostRow[] {
  return rows.flatMap((row): LinkedInPostRow[] => {
    const title = row["Post title"];
    const link = row["Post link"];
    // Trailing blank rows.
    if (!title && !link) return [];
    return [
      {
        post_title: textOrNull(title),
        post_link: textOrNull(link),
        post_type: textOrNull(row["Post type"]),
        posted_by: textOrNull(row["Posted by"]),
        created_date: parseDateCell(row["Created date"]),
        content_type: textOrNull(row["Content Type"]),
        impressions: intNum(row["Impressions"]),
        views: intNum(row["Views"]),
        offsite_views: intNum(row["Offsite Views"]),
        clicks: intNum(row["Clicks"]),
        click_through_rate: num(row["Click through rate (CTR)"]),
        likes: intNum(row["Likes"]),
        comments: intNum(row["Comments"]),
        reposts: intNum(row["Reposts"]),
        follows: intNum(row["Follows"]),
        engagement_rate: num(row["Engagement rate"]),
      },
    ];
  });
}
