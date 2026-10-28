import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type {
  CompanyDailyMetricRecord,
  CompanyPostRecord,
  FacebookDailyMetricRecord,
  InstagramDailyMetricRecord,
  TiktokDailyMetricRecord,
} from "@/lib/supabase/database.types";
import type { SocialPlatform } from "@/lib/social-platforms";

// Re-export from the client-safe module so server callers can still grab the
// type from here. Constants (PLATFORM_LABELS, SUPPORTED_PLATFORMS) must be
// imported directly from `@/lib/social-platforms` by client components — see
// the comment in that file for the reason.
export type { SocialPlatform };

export interface CompanyUploadSummary {
  id: string;
  reportMonth: string;
  monthLabel: string;
  fileName: string;
  /** Original file in Storage; null for Facebook/Instagram API fetches. */
  storagePath: string | null;
  uploadedAt: string;
  uploadedByEmail: string | null;
  platform: SocialPlatform;
}

export interface TiktokDailyMetricRow {
  id: string;
  uploadId: string;
  date: string;
  videoViews: number;
  profileViews: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface FacebookDailyMetricRow {
  id: string;
  uploadId: string;
  date: string;
  impressions: number;
  reach: number;
  engagedUsers: number;
  newFollowers: number;
  postImpressions: number;
  postEngagements: number;
}

export interface InstagramDailyMetricRow {
  id: string;
  uploadId: string;
  date: string;
  reach: number;
  views: number;
  profileViews: number;
  accountsEngaged: number;
  totalInteractions: number;
  // Cumulative snapshot of total followers — UI should NOT sum across days.
  followerCount: number;
}

export interface MetaConnectionRow {
  id: string;
  pageId: string;
  pageName: string | null;
  // The token is never readable from the app — the database only hands it to
  // the server-side Graph API fetch (see meta_access_token in the migration).
  instagramAccountId: string | null;
  instagramUsername: string | null;
  connectedAt: string;
  connectedByEmail: string | null;
}

export interface CompanyDailyMetricRow {
  id: string;
  uploadId: string;
  date: string;
  impressions: number;
  impressionsOrganic: number;
  impressionsSponsored: number;
  uniqueImpressions: number;
  clicks: number;
  clicksOrganic: number;
  clicksSponsored: number;
  reactions: number;
  reactionsOrganic: number;
  reactionsSponsored: number;
  comments: number;
  commentsOrganic: number;
  commentsSponsored: number;
  reposts: number;
  repostsOrganic: number;
  repostsSponsored: number;
  engagementRate: number;
  engagementRateOrganic: number;
  engagementRateSponsored: number;
}

export interface CompanyPostRow {
  id: string;
  uploadId: string;
  postTitle: string | null;
  postLink: string | null;
  postType: string | null;
  postedBy: string | null;
  createdDate: string | null;
  contentType: string | null;
  impressions: number;
  views: number;
  offsiteViews: number;
  clicks: number;
  clickThroughRate: number;
  likes: number;
  comments: number;
  reposts: number;
  follows: number;
  engagementRate: number;
}

export async function listCompanyUploads(): Promise<CompanyUploadSummary[]> {
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase
      .from("company_analytics_uploads")
      .select("*")
      // Newest report month first; tie-break by upload time.
      .order("report_month", { ascending: false })
      .order("uploaded_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  return rows.map((u) => ({
    id: u.id,
    reportMonth: u.report_month,
    monthLabel: u.month_label,
    fileName: u.file_name,
    storagePath: u.storage_path,
    uploadedAt: u.uploaded_at,
    uploadedByEmail: u.uploaded_by_email,
    platform: u.platform,
  }));
}

function pickMetric(m: CompanyDailyMetricRecord): CompanyDailyMetricRow {
  return {
    id: m.id,
    uploadId: m.upload_id,
    date: m.date,
    impressions: m.impressions,
    impressionsOrganic: m.impressions_organic ?? 0,
    impressionsSponsored: m.impressions_sponsored ?? 0,
    uniqueImpressions: m.unique_impressions,
    clicks: m.clicks,
    clicksOrganic: m.clicks_organic ?? 0,
    clicksSponsored: m.clicks_sponsored ?? 0,
    reactions: m.reactions,
    reactionsOrganic: m.reactions_organic ?? 0,
    reactionsSponsored: m.reactions_sponsored ?? 0,
    comments: m.comments,
    commentsOrganic: m.comments_organic ?? 0,
    commentsSponsored: m.comments_sponsored ?? 0,
    reposts: m.reposts,
    repostsOrganic: m.reposts_organic ?? 0,
    repostsSponsored: m.reposts_sponsored ?? 0,
    engagementRate: m.engagement_rate,
    engagementRateOrganic: m.engagement_rate_organic ?? 0,
    engagementRateSponsored: m.engagement_rate_sponsored ?? 0,
  };
}

function pickPost(p: CompanyPostRecord): CompanyPostRow {
  return {
    id: p.id,
    uploadId: p.upload_id,
    postTitle: p.post_title,
    postLink: p.post_link,
    postType: p.post_type,
    postedBy: p.posted_by,
    createdDate: p.created_date,
    contentType: p.content_type,
    impressions: p.impressions,
    views: p.views ?? 0,
    offsiteViews: p.offsite_views ?? 0,
    clicks: p.clicks,
    clickThroughRate: p.click_through_rate,
    likes: p.likes,
    comments: p.comments,
    reposts: p.reposts,
    follows: p.follows ?? 0,
    engagementRate: p.engagement_rate,
  };
}

function pickTiktokMetric(m: TiktokDailyMetricRecord): TiktokDailyMetricRow {
  return {
    id: m.id,
    uploadId: m.upload_id,
    date: m.date,
    videoViews: m.video_views,
    profileViews: m.profile_views,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
  };
}

function pickFacebookMetric(m: FacebookDailyMetricRecord): FacebookDailyMetricRow {
  return {
    id: m.id,
    uploadId: m.upload_id,
    date: m.date,
    impressions: m.impressions,
    reach: m.reach,
    engagedUsers: m.engaged_users,
    newFollowers: m.new_followers,
    postImpressions: m.post_impressions,
    postEngagements: m.post_engagements,
  };
}

function pickInstagramMetric(m: InstagramDailyMetricRecord): InstagramDailyMetricRow {
  return {
    id: m.id,
    uploadId: m.upload_id,
    date: m.date,
    reach: m.reach,
    views: m.views,
    profileViews: m.profile_views,
    accountsEngaged: m.accounts_engaged,
    totalInteractions: m.total_interactions,
    followerCount: m.follower_count,
  };
}

type DailyTable =
  | "company_daily_metrics"
  | "tiktok_daily_metrics"
  | "facebook_daily_metrics"
  | "instagram_daily_metrics";

/** Every daily row of one upload, oldest first. */
async function fetchDailyRows<T>(table: DailyTable, uploadId: string): Promise<T[]> {
  const supabase = await createClient();
  return fetchAll((from, to) =>
    supabase
      .from(table)
      .select("*")
      .eq("upload_id", uploadId)
      .order("date")
      .order("id")
      .range(from, to),
  ) as Promise<T[]>;
}

export async function fetchCompanyMetricsForUpload(
  uploadId: string,
): Promise<CompanyDailyMetricRow[]> {
  const rows = await fetchDailyRows<CompanyDailyMetricRecord>("company_daily_metrics", uploadId);
  return rows.map(pickMetric);
}

export async function fetchTiktokMetricsForUpload(
  uploadId: string,
): Promise<TiktokDailyMetricRow[]> {
  const rows = await fetchDailyRows<TiktokDailyMetricRecord>("tiktok_daily_metrics", uploadId);
  return rows.map(pickTiktokMetric);
}

export async function fetchFacebookMetricsForUpload(
  uploadId: string,
): Promise<FacebookDailyMetricRow[]> {
  const rows = await fetchDailyRows<FacebookDailyMetricRecord>("facebook_daily_metrics", uploadId);
  return rows.map(pickFacebookMetric);
}

export async function fetchInstagramMetricsForUpload(
  uploadId: string,
): Promise<InstagramDailyMetricRow[]> {
  const rows = await fetchDailyRows<InstagramDailyMetricRecord>(
    "instagram_daily_metrics",
    uploadId,
  );
  return rows.map(pickInstagramMetric);
}

/** Posts of one upload, most impressions first. */
export async function fetchCompanyPostsForUpload(uploadId: string): Promise<CompanyPostRow[]> {
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase
      .from("company_posts")
      .select("*")
      .eq("upload_id", uploadId)
      .order("impressions", { ascending: false })
      .order("id")
      .range(from, to),
  );
  return rows.map(pickPost);
}

export async function fetchMetaConnection(): Promise<MetaConnectionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meta_connection")
    .select(
      "id, page_id, page_name, instagram_account_id, instagram_username, connected_at, connected_by_email",
    )
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    pageId: data.page_id,
    pageName: data.page_name,
    instagramAccountId: data.instagram_account_id,
    instagramUsername: data.instagram_username,
    connectedAt: data.connected_at,
    connectedByEmail: data.connected_by_email,
  };
}
