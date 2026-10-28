"use server";

import { revalidatePath } from "next/cache";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { DEFAULT_CATEGORIES } from "@/lib/post-categories";
import { createClient } from "@/lib/supabase/server";

export interface CategoryActionResult {
  ok: boolean;
  message: string;
}

interface CategoryFields {
  name: string;
  description: string | null;
  weight: number;
}

// Row-level security already limits these writes to admins; the check here
// just turns a silent no-op into a clear message.
async function requireAdmin(): Promise<CategoryActionResult | null> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") return { ok: false, message: "Only admins can manage categories." };
  return null;
}

function done(error: { message: string } | null, message: string): CategoryActionResult {
  if (error) return { ok: false, message: error.message };
  // Weights feed every score, so every page that ranks people is stale now.
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Put back the starter set. Fixed ids mean it can't duplicate the seed. */
export async function restoreDefaultCategories(): Promise<CategoryActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_categories")
    .upsert(DEFAULT_CATEGORIES, { onConflict: "id", ignoreDuplicates: true });
  return done(error, "Default categories added.");
}

export async function createPostCategory(fields: CategoryFields): Promise<CategoryActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("post_categories").insert({ ...fields, active: true });
  return done(error, `"${fields.name}" added.`);
}

export async function updatePostCategory(
  id: string,
  fields: CategoryFields & { active?: boolean },
): Promise<CategoryActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("post_categories").update(fields).eq("id", id);
  return done(error, `"${fields.name}" saved.`);
}
