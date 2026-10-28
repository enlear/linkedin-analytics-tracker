import type { SupabaseServerClient } from "@/lib/supabase/server";

/** Private bucket holding original company exports; admin-only by policy. */
export const COMPANY_UPLOADS_BUCKET = "company-uploads";

/**
 * Best effort: the database row is the source of truth, so a file left behind
 * only costs storage. Logged rather than surfaced to the admin.
 */
export async function removeCompanyFile(supabase: SupabaseServerClient, path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(COMPANY_UPLOADS_BUCKET).remove([path]);
    if (error) console.error(`[company] could not remove ${path} from storage:`, error.message);
  } catch (e) {
    console.error(`[company] could not remove ${path} from storage:`, e);
  }
}
