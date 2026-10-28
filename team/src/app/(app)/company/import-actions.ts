"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { checkImportFile, importStoragePath } from "@/lib/company-import/files";
import { parseLinkedInCompanyExport, type LinkedInDailyRow, type LinkedInPostRow } from "@/lib/company-import/linkedin";
import { CompanyImportError, parseReportMonth } from "@/lib/company-import/shared";
import { COMPANY_UPLOADS_BUCKET, removeCompanyFile } from "@/lib/company-import/storage";
import { parseTiktokExport, type TiktokDailyRow } from "@/lib/company-import/tiktok";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ImportedUpload =
  | {
      id: string;
      platform: "linkedin";
      reportMonth: string;
      monthLabel: string;
      metricsCount: number;
      postsCount: number;
    }
  | {
      id: string;
      platform: "tiktok";
      reportMonth: string;
      monthLabel: string;
      rowCount: number;
    };

export type CompanyImportResult =
  | { ok: true; code: "accepted"; message: string; upload: ImportedUpload }
  | { ok: false; code: string; message: string };

function reject(code: string, message: string): CompanyImportResult {
  return { ok: false, code, message };
}

/**
 * Admin-only: import a LinkedIn company page or TikTok export for one month.
 * FormData fields: `file`, `platform` ("linkedin" | "tiktok"), `reportMonth`
 * ("YYYY-MM" or "YYYY-MM-DD").
 *
 * The file is parsed before anything is stored, so a bad file leaves no trace.
 * The original is then kept in Storage for re-download, and the month is
 * swapped in one transaction: importing a month again replaces it, and a
 * failure part-way leaves the previous import intact.
 */
export async function importCompanyFile(form: FormData): Promise<CompanyImportResult> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return reject("unauthenticated", "Not authenticated.");
  if (me.role !== "admin") return reject("forbidden", "Only admins can upload company analytics.");

  const platform = form.get("platform");
  if (platform !== "linkedin" && platform !== "tiktok") {
    return reject("invalid_arg", "platform must be linkedin or tiktok.");
  }
  const month = parseReportMonth(String(form.get("reportMonth") ?? ""));
  if (!month) return reject("invalid_arg", "reportMonth must be YYYY-MM-DD format.");
  const file = form.get("file");
  if (!(file instanceof File)) return reject("invalid_arg", "Attach the exported file.");
  const problem = checkImportFile(file.name, file.size);
  if (problem) return reject(problem.code, problem.message);

  const data = await file.arrayBuffer();
  let daily: LinkedInDailyRow[] | TiktokDailyRow[];
  let posts: LinkedInPostRow[] = [];
  try {
    if (platform === "linkedin") ({ daily, posts } = parseLinkedInCompanyExport(data));
    else daily = parseTiktokExport(data, month.reportMonth);
  } catch (e) {
    if (e instanceof CompanyImportError) return reject(e.code, e.message);
    return reject("parse_failed", e instanceof Error ? e.message : "Could not parse the file.");
  }

  const supabase = await createClient();
  const path = importStoragePath(platform, month.monthKey, file.name, randomUUID());
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_UPLOADS_BUCKET)
    .upload(path, data, { contentType: file.type || XLSX_MIME, upsert: false });
  if (uploadError) {
    return reject("upload_failed", `Could not store the file: ${uploadError.message}`);
  }

  const { data: saved, error } = await supabase.rpc("replace_company_upload", {
    p_platform: platform,
    p_report_month: month.reportMonth,
    p_month_label: month.monthLabel,
    p_file_name: file.name,
    p_storage_path: path,
    p_daily: daily,
    p_posts: posts,
  });
  if (error) {
    await removeCompanyFile(supabase, path);
    return reject("db_error", error.message);
  }
  const { id, replacedPath } = readReplaceResult(saved);
  if (replacedPath && replacedPath !== path) await removeCompanyFile(supabase, replacedPath);

  revalidatePath("/company");
  const base = { id, reportMonth: month.reportMonth, monthLabel: month.monthLabel };
  return platform === "linkedin"
    ? {
        ok: true,
        code: "accepted",
        message: "Company analytics saved.",
        upload: { ...base, platform, metricsCount: daily.length, postsCount: posts.length },
      }
    : {
        ok: true,
        code: "accepted",
        message: "TikTok analytics saved.",
        upload: { ...base, platform, rowCount: daily.length },
      };
}

// replace_company_upload returns { id, replaced_storage_path }.
function readReplaceResult(data: Json): { id: string; replacedPath: string | null } {
  const obj = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    id: typeof obj.id === "string" ? obj.id : "",
    replacedPath: typeof obj.replaced_storage_path === "string" ? obj.replaced_storage_path : null,
  };
}

export type OriginalUploadUrlResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * Admin-only: a 60-second signed URL for an import's original file. The
 * `download` option makes Storage send it as an attachment under its
 * original name.
 */
export async function getOriginalUploadUrl(uploadId: string): Promise<OriginalUploadUrlResult> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") return { ok: false, message: "Only admins can download company reports." };
  if (typeof uploadId !== "string" || uploadId.length === 0) {
    return { ok: false, message: "Invalid upload id." };
  }

  const supabase = await createClient();
  const { data: upload, error } = await supabase
    .from("company_analytics_uploads")
    .select("file_name, storage_path")
    .eq("id", uploadId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!upload) return { ok: false, message: "Could not find that upload." };
  if (!upload.storage_path) {
    return { ok: false, message: "This report was fetched from the platform's API, so there's no file to download." };
  }

  const { data, error: signError } = await supabase.storage
    .from(COMPANY_UPLOADS_BUCKET)
    .createSignedUrl(upload.storage_path, 60, { download: upload.file_name });
  if (signError || !data) return { ok: false, message: signError?.message ?? "Download failed." };
  return { ok: true, url: data.signedUrl };
}
