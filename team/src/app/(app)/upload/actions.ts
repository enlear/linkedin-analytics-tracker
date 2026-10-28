"use server";

import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import {
  LinkedInExportParseError,
  parsePostExport,
  type ParsedPost,
} from "@/lib/linkedin/parse-export";
import { getFilingPeriodForPostDate, toIsoDate } from "@/lib/period";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export interface UploadOutcome {
  ok: boolean;
  code: string;
  message: string;
  post?: {
    id: string;
    postUrl: string | null;
    postDate: string;
    postPublishTime: string | null;
    impressions: number;
    reach: number;
    fileName: string;
    categoryName?: string;
  };
}

// Single-post exports are a few KB; this only stops someone posting junk. It
// sits below next.config's 4 MiB action limit, which also counts the
// multipart framing around the file.
const MAX_POST_EXPORT_BYTES = 4_000_000;

const DUPLICATE_POST_UNIQUE_VIOLATION = "23505";

/**
 * Parse, validate and store one LinkedIn single-post analytics export for the
 * signed-in member. The file is read in memory and never stored: only the
 * extracted numbers are saved.
 *
 * Every write runs as the member, so row-level security guarantees they can
 * only file posts under their own name.
 */
export async function ingestPostUpload(formData: FormData): Promise<UploadOutcome> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return reject("invalid_file", "Not authenticated.");
  if (me.role === "admin") return reject("invalid_file", "Admins cannot upload analytics files.");

  const file = formData.get("file");
  const categoryId = formData.get("categoryId");
  if (!(file instanceof File) || typeof categoryId !== "string" || !categoryId) {
    return reject("invalid_file", "Choose a post type and an .xlsx file.");
  }
  if (file.size > MAX_POST_EXPORT_BYTES) {
    return reject("invalid_file", "That file is over 4 MB, so it isn't a post analytics export.");
  }
  const fileName = file.name;

  const supabase = await createClient();
  const logActivity = async (
    action: "upload_accepted" | "upload_rejected",
    details: Record<string, Json>,
  ) => {
    // Best effort: the activity feed must never cost the member their upload.
    await supabase
      .from("upload_activity")
      .insert({ employee_id: me.id, action, file_name: fileName, details });
  };

  // Archived categories are hidden from the picker; rejecting them here too
  // stops a stale form (or a hand-crafted call) from filing under one.
  const { data: category } = await supabase
    .from("post_categories")
    .select("id, name, active")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category || !category.active) {
    await logActivity("upload_rejected", { reason: "invalid_category", category_id: categoryId });
    return reject(
      "invalid_category",
      "That post category is no longer available. Refresh the page and pick another.",
    );
  }

  let parsed: ParsedPost;
  try {
    parsed = await parsePostExport(await file.arrayBuffer());
  } catch (e) {
    const code = e instanceof LinkedInExportParseError ? e.code : "read_failed";
    const message = e instanceof Error ? e.message : "Could not parse the file.";
    await logActivity("upload_rejected", { reason: code, message });
    return reject(code, message);
  }

  // No date gating: every post is accepted and filed under the report month
  // its post date lands in.
  const period = getFilingPeriodForPostDate(parsed.postDate);

  if (parsed.postUrl) {
    const { data: existing } = await supabase
      .from("post_uploads")
      .select("id, employee_id")
      .eq("post_url", parsed.postUrl)
      .eq("validation_status", "accepted")
      .limit(1)
      .maybeSingle();
    if (existing) {
      await logActivity("upload_rejected", {
        reason: "duplicate",
        duplicate_id: existing.id,
        duplicate_owner_id: existing.employee_id,
        matched_on: "post_url",
      });
      return reject(
        "duplicate",
        existing.employee_id === me.id
          ? "You've already uploaded this post URL."
          : "Another teammate has already uploaded this post URL.",
      );
    }
  }

  const { data: inserted, error } = await supabase
    .from("post_uploads")
    .insert({
      employee_id: me.id,
      file_name: fileName,
      source_sheet_name: parsed.sourceSheetName,
      post_url: parsed.postUrl,
      post_date: parsed.postDate,
      post_publish_time: parsed.postPublishTime,
      impressions: parsed.impressions,
      reach: parsed.reach,
      report_month: toIsoDate(period.reportMonth),
      tracking_period_start: toIsoDate(period.start),
      tracking_period_end: toIsoDate(period.end),
      validation_status: "accepted",
      source: "excel",
      category_id: category.id,
      raw_extracted: parsed.raw as Json,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Someone filed the same post between the check above and this insert.
    if (error?.code === DUPLICATE_POST_UNIQUE_VIOLATION) {
      await logActivity("upload_rejected", { reason: "duplicate", matched_on: "post_url" });
      return reject("duplicate", "This post URL has already been uploaded.");
    }
    const message = error?.message ?? "Could not save the upload.";
    await logActivity("upload_rejected", { reason: "db_error", message });
    return reject("invalid_file", message);
  }

  await logActivity("upload_accepted", {
    post_url: parsed.postUrl,
    post_date: parsed.postDate,
    impressions: parsed.impressions,
    reach: parsed.reach,
    category_id: category.id,
    category_name: category.name,
  });

  return {
    ok: true,
    code: "accepted",
    message: "Post analytics saved.",
    post: {
      id: inserted.id,
      postUrl: parsed.postUrl,
      postDate: parsed.postDate,
      postPublishTime: parsed.postPublishTime,
      impressions: parsed.impressions,
      reach: parsed.reach,
      fileName,
      categoryName: category.name,
    },
  };
}

function reject(code: string, message: string): UploadOutcome {
  return { ok: false, code, message };
}
