"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseConfig } from "./env";

/**
 * Supabase client for client components. Used for sign-in and sign-out only;
 * data reads and writes go through server components and server actions.
 */
export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient<Database>(url, key);
}
