"use server";

import { revalidatePath } from "next/cache";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { parseReportMonth, type ReportMonth } from "@/lib/meta/graph";
import {
  buildFacebookDailyRows,
  fetchFacebookPageInsights,
  type FacebookInsight,
} from "@/lib/meta/facebook";
import {
  buildInstagramDailyRows,
  fetchInstagramAccountInsights,
  type InstagramInsight,
} from "@/lib/meta/instagram";

type MetaPlatform = "facebook" | "instagram";

export type MetaFetchResult =
  | {
      ok: true;
      code: "accepted";
      message: string;
      upload: {
        id: string;
        platform: MetaPlatform;
        reportMonth: string;
        monthLabel: string;
        rowCount: number;
      };
    }
  | {
      ok: false;
      code:
        | "unauthenticated"
        | "forbidden"
        | "invalid_arg"
        | "not_connected"
        | "no_instagram"
        | "graph_error"
        | "empty"
        | "db_error";
      message: string;
    };

type MetaFetchFailure = Extract<MetaFetchResult, { ok: false }>;

function reject(code: MetaFetchFailure["code"], message: string): MetaFetchFailure {
  return { ok: false, code, message };
}

async function rejectUnlessAdmin(platformLabel: string): Promise<MetaFetchFailure | null> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return reject("unauthenticated", "Not authenticated.");
  if (me.role !== "admin") {
    return reject("forbidden", `Only admins can fetch ${platformLabel} insights.`);
  }
  return null;
}

interface StoredConnection {
  pageId: string;
  pageName: string | null;
  instagramAccountId: string | null;
  instagramUsername: string | null;
  accessToken: string | null;
}

async function readConnection(
  supabase: SupabaseServerClient,
): Promise<StoredConnection | null | MetaFetchFailure> {
  // The token column isn't selectable; meta_access_token hands it to admins.
  const [connection, token] = await Promise.all([
    supabase
      .from("meta_connection")
      .select("page_id, page_name, instagram_account_id, instagram_username")
      .maybeSingle(),
    supabase.rpc("meta_access_token"),
  ]);
  const error = connection.error ?? token.error;
  if (error) return reject("db_error", error.message);
  if (!connection.data) return null;
  return {
    pageId: connection.data.page_id,
    pageName: connection.data.page_name,
    instagramAccountId: connection.data.instagram_account_id,
    instagramUsername: connection.data.instagram_username,
    accessToken: token.data,
  };
}

function isFailure(value: unknown): value is MetaFetchFailure {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

/** Swaps in the month's rows in one transaction, replacing any earlier fetch. */
async function replaceMonth(
  supabase: SupabaseServerClient,
  platform: MetaPlatform,
  month: ReportMonth,
  fileName: string,
  rows: Json,
): Promise<{ id: string } | MetaFetchFailure> {
  const { data, error } = await supabase.rpc("replace_company_upload", {
    p_platform: platform,
    p_report_month: month.reportMonth,
    p_month_label: month.monthLabel,
    p_file_name: fileName,
    p_storage_path: null,
    p_daily: rows,
  });
  if (error) return reject("db_error", error.message);
  const id =
    data && typeof data === "object" && !Array.isArray(data) && typeof data.id === "string"
      ? data.id
      : null;
  if (!id) return reject("db_error", "Could not save fetched data.");
  return { id };
}

/** Admin-only: pull the month's daily Page Insights and replace any earlier fetch. */
export async function fetchFacebookInsights(reportMonthIso: string): Promise<MetaFetchResult> {
  const denied = await rejectUnlessAdmin("Facebook");
  if (denied) return denied;

  const month = parseReportMonth(reportMonthIso);
  if (!month) return reject("invalid_arg", "reportMonth must be YYYY-MM-DD format.");

  const supabase = await createClient();
  const conn = await readConnection(supabase);
  if (isFailure(conn)) return conn;
  if (!conn || !conn.pageId || !conn.accessToken) {
    return reject(
      "not_connected",
      "Facebook isn't connected yet. Paste your Page ID + access token in Settings first.",
    );
  }

  let insights: FacebookInsight[];
  try {
    insights = await fetchFacebookPageInsights(conn.pageId, conn.accessToken, month);
  } catch (e) {
    return reject("graph_error", e instanceof Error ? e.message : "Graph API call failed.");
  }

  const rows = buildFacebookDailyRows(insights, month.reportMonth);
  if (rows.length === 0) {
    return reject(
      "empty",
      "Graph API returned no data for this month — check the date range, page id, and token permissions.",
    );
  }

  const fileName = conn.pageName
    ? `Facebook · ${conn.pageName} · ${month.monthLabel}`
    : `Facebook · ${month.monthLabel}`;
  const saved = await replaceMonth(supabase, "facebook", month, fileName, rows);
  if (isFailure(saved)) return saved;

  revalidatePath("/company");
  return {
    ok: true,
    code: "accepted",
    message: `Fetched ${rows.length} days of Facebook insights.`,
    upload: {
      id: saved.id,
      platform: "facebook",
      reportMonth: month.reportMonth,
      monthLabel: month.monthLabel,
      rowCount: rows.length,
    },
  };
}

/** Admin-only: pull the month's Instagram insights and replace any earlier fetch. */
export async function fetchInstagramInsights(reportMonthIso: string): Promise<MetaFetchResult> {
  const denied = await rejectUnlessAdmin("Instagram");
  if (denied) return denied;

  const month = parseReportMonth(reportMonthIso);
  if (!month) return reject("invalid_arg", "reportMonth must be YYYY-MM-DD format.");

  const supabase = await createClient();
  const conn = await readConnection(supabase);
  if (isFailure(conn)) return conn;
  if (!conn || !conn.accessToken) {
    return reject(
      "not_connected",
      "Meta isn't connected yet. Connect a Facebook Page in Settings first.",
    );
  }
  if (!conn.instagramAccountId) {
    return reject(
      "no_instagram",
      "Instagram Business Account ID isn't set on the connection. Add it in Settings → Facebook connection.",
    );
  }

  let insights: InstagramInsight[];
  try {
    insights = await fetchInstagramAccountInsights(
      conn.instagramAccountId,
      conn.accessToken,
      month,
    );
  } catch (e) {
    return reject("graph_error", e instanceof Error ? e.message : "Graph API call failed.");
  }

  const rows = buildInstagramDailyRows(insights, month.reportMonth);
  if (rows.length === 0) {
    return reject(
      "empty",
      "Graph API returned no Instagram data for this month — check the IG account ID and token permissions.",
    );
  }

  const fileName = conn.instagramUsername
    ? `Instagram · @${conn.instagramUsername} · ${month.monthLabel}`
    : `Instagram · ${month.monthLabel}`;
  const saved = await replaceMonth(supabase, "instagram", month, fileName, rows);
  if (isFailure(saved)) return saved;

  revalidatePath("/company");
  return {
    ok: true,
    code: "accepted",
    message: `Fetched ${rows.length} days of Instagram insights.`,
    upload: {
      id: saved.id,
      platform: "instagram",
      reportMonth: month.reportMonth,
      monthLabel: month.monthLabel,
      rowCount: rows.length,
    },
  };
}
