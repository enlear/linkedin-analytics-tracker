"use server";

import { revalidatePath } from "next/cache";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { createClient } from "@/lib/supabase/server";

export interface MetaConnectionInput {
  pageId: string;
  pageName: string | null;
  /** Blank keeps the stored token, so details can change without re-pasting it. */
  pageAccessToken: string | null;
  instagramAccountId: string | null;
  instagramUsername: string | null;
}

export interface MetaConnectionResult {
  ok: boolean;
  message: string;
}

async function rejectUnlessAdmin(): Promise<MetaConnectionResult | null> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") {
    return { ok: false, message: "Only admins can change the Meta connection." };
  }
  return null;
}

// Action arguments arrive from the browser, so don't trust their types.
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function revalidateMetaPages() {
  revalidatePath("/settings");
  revalidatePath("/company");
}

/**
 * Admin-only: create or update the single Meta connection. The token is
 * written by the database and never read back, so this is the only way in.
 */
export async function saveMetaConnection(
  input: MetaConnectionInput,
): Promise<MetaConnectionResult> {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const supabase = await createClient();
  // save_meta_connection validates the page id and first-save token itself,
  // with messages meant for the admin.
  const { error } = await supabase.rpc("save_meta_connection", {
    p_page_id: text(input?.pageId) ?? "",
    p_page_name: text(input?.pageName),
    p_page_access_token: text(input?.pageAccessToken),
    p_instagram_account_id: text(input?.instagramAccountId),
    p_instagram_username: text(input?.instagramUsername),
  });
  if (error) return { ok: false, message: error.message };

  revalidateMetaPages();
  return { ok: true, message: "Facebook connection saved." };
}

/** Admin-only: forget the Page and token. Fetched months stay. */
export async function disconnectMetaConnection(): Promise<MetaConnectionResult> {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meta_connection").delete().eq("id", "default");
  if (error) return { ok: false, message: error.message };

  revalidateMetaPages();
  return { ok: true, message: "Disconnected." };
}
