import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { sortCategories, type PostCategory } from "@/lib/post-categories";

/**
 * Every post category, active and archived, heaviest first. Wrapped in
 * React `cache` so the several post fetchers a dashboard runs share a single
 * read per request.
 */
export const fetchPostCategories = cache(async (): Promise<PostCategory[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_categories")
    .select("id, name, description, weight, active");
  if (error) throw new Error(error.message);
  return sortCategories(data ?? []);
});
