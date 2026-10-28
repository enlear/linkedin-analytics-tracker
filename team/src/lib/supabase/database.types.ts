// Types for the tables in supabase/migrations, in the shape `supabase gen
// types typescript` produces. Keep them in step with the SQL when it changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Row type plus the Insert/Update shapes PostgREST accepts for it. */
type Table<
  Row extends Record<string, unknown>,
  Required extends keyof Row,
  Relationships extends unknown[] = [],
> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type BelongsTo<Fk extends string, Column extends string, Target extends string> = {
  foreignKeyName: Fk;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ["id"];
};

type UploadChild<Fk extends string> = [BelongsTo<Fk, "upload_id", "company_analytics_uploads">];

export type SocialPlatform = "linkedin" | "tiktok" | "facebook" | "instagram";
export type ActivityAction = "upload_accepted" | "upload_rejected" | "upload_deleted";
export type LinkedInConnectionState = "pending" | "connected" | "error" | "disconnected";

export type EmployeeRecord = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  created_at: string;
};

export type PostCategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  active: boolean;
  created_at: string;
};

export type PostUploadRecord = {
  id: string;
  employee_id: string;
  file_name: string;
  source_sheet_name: string | null;
  post_url: string | null;
  post_date: string;
  post_publish_time: string | null;
  impressions: number;
  reach: number;
  report_month: string;
  tracking_period_start: string;
  tracking_period_end: string;
  validation_status: "accepted" | "rejected";
  rejection_reason: string | null;
  source: "excel" | "linkedin_api";
  category_id: string | null;
  raw_extracted: Json | null;
  created_at: string;
};

export type UploadActivityRecord = {
  id: string;
  employee_id: string;
  action: ActivityAction;
  file_name: string | null;
  details: Json | null;
  occurred_at: string;
};

export type CompanyAnalyticsUploadRecord = {
  id: string;
  platform: SocialPlatform;
  report_month: string;
  month_label: string;
  file_name: string;
  storage_path: string | null;
  uploaded_at: string;
  uploaded_by_email: string | null;
};

export type CompanyDailyMetricRecord = {
  id: string;
  upload_id: string;
  date: string;
  impressions: number;
  impressions_organic: number | null;
  impressions_sponsored: number | null;
  unique_impressions: number;
  clicks: number;
  clicks_organic: number | null;
  clicks_sponsored: number | null;
  reactions: number;
  reactions_organic: number | null;
  reactions_sponsored: number | null;
  comments: number;
  comments_organic: number | null;
  comments_sponsored: number | null;
  reposts: number;
  reposts_organic: number | null;
  reposts_sponsored: number | null;
  engagement_rate: number;
  engagement_rate_organic: number | null;
  engagement_rate_sponsored: number | null;
};

export type CompanyPostRecord = {
  id: string;
  upload_id: string;
  post_title: string | null;
  post_link: string | null;
  post_type: string | null;
  posted_by: string | null;
  created_date: string | null;
  content_type: string | null;
  impressions: number;
  views: number | null;
  offsite_views: number | null;
  clicks: number;
  click_through_rate: number;
  likes: number;
  comments: number;
  reposts: number;
  follows: number | null;
  engagement_rate: number;
};

export type TiktokDailyMetricRecord = {
  id: string;
  upload_id: string;
  date: string;
  video_views: number;
  profile_views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type FacebookDailyMetricRecord = {
  id: string;
  upload_id: string;
  date: string;
  impressions: number;
  reach: number;
  engaged_users: number;
  new_followers: number;
  post_impressions: number;
  post_engagements: number;
};

export type InstagramDailyMetricRecord = {
  id: string;
  upload_id: string;
  date: string;
  reach: number;
  views: number;
  profile_views: number;
  accounts_engaged: number;
  total_interactions: number;
  follower_count: number;
};

/** The columns a browser may read; the token itself is not one of them. */
export type MetaConnectionRecord = {
  id: string;
  page_id: string;
  page_name: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  connected_at: string;
  connected_by_email: string | null;
};

export type LinkedInConnectionRecord = {
  employee_id: string;
  status: LinkedInConnectionState | null;
  linkedin_member_urn: string | null;
  granted_scopes: string | null;
  pending_state: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

/** A child row as replace_company_upload expects it: no ids. */
export type DailyRowInput<T> = Omit<T, "id" | "upload_id">;

export type Database = {
  public: {
    Tables: {
      employees: Table<EmployeeRecord, "id" | "email">;
      post_categories: Table<PostCategoryRecord, "name" | "weight">;
      post_uploads: Table<
        PostUploadRecord,
        | "employee_id"
        | "file_name"
        | "post_date"
        | "impressions"
        | "reach"
        | "report_month"
        | "tracking_period_start"
        | "tracking_period_end",
        [
          BelongsTo<"post_uploads_employee_id_fkey", "employee_id", "employees">,
          BelongsTo<"post_uploads_category_id_fkey", "category_id", "post_categories">,
        ]
      >;
      upload_activity: Table<
        UploadActivityRecord,
        "employee_id" | "action",
        [BelongsTo<"upload_activity_employee_id_fkey", "employee_id", "employees">]
      >;
      company_analytics_uploads: Table<
        CompanyAnalyticsUploadRecord,
        "report_month" | "month_label" | "file_name"
      >;
      company_daily_metrics: Table<
        CompanyDailyMetricRecord,
        "upload_id" | "date",
        UploadChild<"company_daily_metrics_upload_id_fkey">
      >;
      company_posts: Table<
        CompanyPostRecord,
        "upload_id",
        UploadChild<"company_posts_upload_id_fkey">
      >;
      tiktok_daily_metrics: Table<
        TiktokDailyMetricRecord,
        "upload_id" | "date",
        UploadChild<"tiktok_daily_metrics_upload_id_fkey">
      >;
      facebook_daily_metrics: Table<
        FacebookDailyMetricRecord,
        "upload_id" | "date",
        UploadChild<"facebook_daily_metrics_upload_id_fkey">
      >;
      instagram_daily_metrics: Table<
        InstagramDailyMetricRecord,
        "upload_id" | "date",
        UploadChild<"instagram_daily_metrics_upload_id_fkey">
      >;
      meta_connection: Table<MetaConnectionRecord, "page_id">;
      linkedin_connections: Table<
        LinkedInConnectionRecord,
        "employee_id",
        [BelongsTo<"linkedin_connections_employee_id_fkey", "employee_id", "employees">]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      replace_company_upload: {
        Args: {
          p_platform: SocialPlatform;
          p_report_month: string;
          p_month_label: string;
          p_file_name: string;
          p_storage_path: string | null;
          p_daily: Json;
          p_posts?: Json;
        };
        Returns: Json;
      };
      save_meta_connection: {
        Args: {
          p_page_id: string;
          p_page_name: string | null;
          p_page_access_token: string | null;
          p_instagram_account_id: string | null;
          p_instagram_username: string | null;
        };
        Returns: undefined;
      };
      meta_access_token: { Args: Record<string, never>; Returns: string | null };
      delete_employee_account: { Args: { p_employee_id: string }; Returns: string };
      ping: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
