// Pure mapping from LinkedIn Posts API elements to post_uploads rows. No I/O,
// so the filing and de-dup rules can be unit-tested on their own.

import type { Database } from "@/lib/supabase/database.types";
import { normalizePostUrl } from "@/lib/linkedin/parse-export";
import {
  buildPeriod,
  getFilingPeriodForPostDate,
  toIsoDate,
  type TrackingPeriod,
} from "@/lib/period";

export type PostUploadInsert = Database["public"]["Tables"]["post_uploads"]["Insert"];

/** file_name for synced rows, so they read differently from uploaded files. */
export const API_IMPORT_FILE_NAME = "LinkedIn API import";

export const METRIC_QUERY_TYPES = {
  impressions: "IMPRESSION",
  reach: "MEMBERS_REACHED",
} as const;

/** One element of the Posts API `q=author` response (fields we use). */
export interface RawPost {
  /** urn:li:ugcPost:… or urn:li:share:… */
  id: string;
  publishedAt?: number;
  createdAt?: number;
  commentary?: string;
}

export interface MatchedPost {
  post: RawPost;
  /** publishedAt, falling back to createdAt (epoch ms). */
  epoch: number;
  /** UTC publish date, YYYY-MM-DD. */
  postDate: string;
  period: TrackingPeriod;
  postUrl: string;
}

export interface PostMetrics {
  impressions: number;
  reach: number;
}

/**
 * The canonical feed URL for a post URN — matches what LinkedIn's xlsx export
 * records, so dedup-by-URL works across the API and Excel ingestion paths.
 * Accepts ugcPost or share URNs.
 */
export function postUrlFromUrn(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/** The report period for a "YYYY-MM-…" argument, or null if it isn't one. */
export function parseReportMonth(input: string): TrackingPeriod | null {
  const m = input.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return buildPeriod(Number(m[1]), month - 1);
}

/**
 * Keep the posts filed under `reportMonth` by the day-20 rule, the same rule
 * the xlsx upload path applies to an exported post's date. Posts with no
 * timestamp can't be filed and are dropped.
 */
export function matchPostsToReportMonth(posts: RawPost[], reportMonth: TrackingPeriod): MatchedPost[] {
  const target = toIsoDate(reportMonth.reportMonth);
  const matched: MatchedPost[] = [];
  for (const post of posts) {
    const epoch = post.publishedAt ?? post.createdAt;
    if (!epoch) continue;
    const postDate = isoDateFromEpoch(epoch);
    const period = getFilingPeriodForPostDate(postDate);
    if (toIsoDate(period.reportMonth) !== target) continue;
    matched.push({ post, epoch, postDate, period, postUrl: normalizePostUrl(postUrlFromUrn(post.id)) });
  }
  return matched;
}

/** The post_uploads row for a synced post, in the same shape an upload writes. */
export function toPostUploadRow(
  employeeId: string,
  { post, epoch, postDate, period, postUrl }: MatchedPost,
  { impressions, reach }: PostMetrics,
): PostUploadInsert {
  return {
    employee_id: employeeId,
    file_name: API_IMPORT_FILE_NAME,
    source_sheet_name: null,
    post_url: postUrl,
    post_date: postDate,
    post_publish_time: timeFromEpoch(epoch),
    impressions,
    reach,
    report_month: toIsoDate(period.reportMonth),
    tracking_period_start: toIsoDate(period.start),
    tracking_period_end: toIsoDate(period.end),
    validation_status: "accepted",
    rejection_reason: null,
    source: "linkedin_api",
    // API posts carry no post type; scoring treats null as the neutral weight.
    category_id: null,
    raw_extracted: {
      source: "linkedin_api",
      urn: post.id,
      commentary: post.commentary ?? null,
      publishedAt: epoch,
      metrics: {
        [METRIC_QUERY_TYPES.impressions]: impressions,
        [METRIC_QUERY_TYPES.reach]: reach,
      },
    },
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDateFromEpoch(ms: number): string {
  return toIsoDate(new Date(ms));
}

/** "7:05 AM UTC" — the xlsx export's "Post Publish Time" style, pinned to UTC. */
export function timeFromEpoch(ms: number): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(d.getUTCMinutes())} ${ampm} UTC`;
}
