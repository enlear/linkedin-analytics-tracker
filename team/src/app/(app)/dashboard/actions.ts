"use server";

import { revalidatePath } from "next/cache";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { createClient } from "@/lib/supabase/server";

export interface DeletePostResult {
  ok: boolean;
  message: string;
}

/**
 * Delete one of the CURRENT member's own uploads, from any tracking period.
 *
 * Deleting the PostUpload row removes every trace of that file's data — the
 * headline metrics AND the raw parsed contents stored in `raw_extracted` — and
 * all stats (leaderboard, totals, scores) are recomputed from the remaining
 * rows on read, so nothing lingers. Deletion is owner-scoped: row-level
 * security only lets a member delete rows whose employee_id is their own.
 */
export async function deletePostUpload(postId: string): Promise<DeletePostResult> {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) return { ok: false, message: "Not authenticated." };
  if (employee.role === "admin") {
    return { ok: false, message: "Admins cannot delete uploads from this view." };
  }
  if (typeof postId !== "string" || postId.length === 0) {
    return { ok: false, message: "Invalid post id." };
  }

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("post_uploads")
    .delete()
    .eq("id", postId)
    .eq("employee_id", employee.id)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!deleted?.length) return { ok: false, message: "Post not found." };

  revalidatePath("/dashboard");
  revalidatePath("/upload");
  revalidatePath("/team");
  revalidatePath("/settings");

  return { ok: true, message: "Post removed." };
}

/**
 * Admin-only counterpart that can delete ANY post regardless of which
 * tracking period it belongs to. Used from /team/[id] where an admin reviews
 * a specific employee's uploads. Records the deletion under the original
 * owner's id with `deleted_by_admin: <admin-email>` in details for audit.
 */
export async function adminDeletePostUpload(postId: string): Promise<DeletePostResult> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") {
    return { ok: false, message: "Only admins can delete from the team view." };
  }
  if (typeof postId !== "string" || postId.length === 0) {
    return { ok: false, message: "Invalid post id." };
  }

  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("post_uploads")
    .delete()
    .eq("id", postId)
    .select("employee_id, file_name, post_url, post_date, report_month")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!existing) return { ok: false, message: "Post not found." };

  await supabase.from("upload_activity").insert({
    employee_id: existing.employee_id,
    action: "upload_deleted",
    file_name: existing.file_name,
    details: {
      post_id: postId,
      post_url: existing.post_url,
      post_date: existing.post_date,
      report_month: existing.report_month,
      deleted_by_admin: me.email,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath(`/team/${existing.employee_id}`);

  return { ok: true, message: "Post removed." };
}
