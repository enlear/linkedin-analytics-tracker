"use server";

import { revalidatePath } from "next/cache";
import { removeCompanyFile } from "@/lib/company-import/storage";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { createClient } from "@/lib/supabase/server";

export interface DeleteCompanyUploadResult {
  ok: boolean;
  message: string;
}

/**
 * Admin-only: delete a company analytics upload. Its daily metric and post
 * rows go with it (foreign keys cascade), then the original file is removed
 * from Storage. API fetches (Facebook/Instagram) have no file.
 */
export async function deleteCompanyUpload(uploadId: string): Promise<DeleteCompanyUploadResult> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") {
    return { ok: false, message: "Only admins can delete company reports." };
  }
  if (typeof uploadId !== "string" || uploadId.length === 0) {
    return { ok: false, message: "Invalid upload id." };
  }

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("company_analytics_uploads")
    .delete()
    .eq("id", uploadId)
    .select("month_label, storage_path")
    .maybeSingle();
  if (error) {
    console.error("[company] deleteCompanyUpload failed:", error);
    return { ok: false, message: error.message };
  }
  if (!deleted) return { ok: false, message: "Report not found." };

  // After the row, so a failure here can't leave a report whose file is gone.
  if (deleted.storage_path) await removeCompanyFile(supabase, deleted.storage_path);

  revalidatePath("/company");
  return { ok: true, message: `Deleted ${deleted.month_label}.` };
}
