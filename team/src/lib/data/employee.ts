import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type EmployeeRole = "admin" | "member";

export interface CurrentEmployee {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  role: EmployeeRole;
}

const PROFILE_COLUMNS = "id, email, name, avatar_url, headline";

/**
 * Returns the current user's profile, or null when nobody is signed in.
 *
 * - **Members**: read from `employees`, created on first call so posts and
 *   activity have a row to point at.
 * - **Admins**: a virtual record built from the auth user only. Admins aren't
 *   posters, and a row would put them on the leaderboard as "yet to upload".
 *
 * Role comes from `app_metadata.role`, which only the database owner can set
 * (see make_admin in supabase/migrations), so nobody can make themselves admin.
 *
 * Cached per request: the layout and the page share one lookup.
 */
export const getOrBootstrapCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  const supabase = await createClient();

  // getUser asks the auth server rather than trusting the cookie, so a member
  // an admin has just deleted is signed out here instead of half-loading.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const role: EmployeeRole = user.app_metadata?.role === "admin" ? "admin" : "member";
  // Email sign-up stores `name`; Google provides `full_name` and `avatar_url`.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = stringOrNull(meta.full_name) ?? stringOrNull(meta.name);
  const picture = stringOrNull(meta.avatar_url) ?? stringOrNull(meta.picture);
  const email = user.email ?? "";

  const virtualProfile: CurrentEmployee = {
    id: user.id,
    email,
    name,
    avatarUrl: picture,
    headline: null,
    role,
  };
  if (role === "admin") return virtualProfile;

  const shape = (e: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    headline: string | null;
  }): CurrentEmployee => ({
    id: e.id,
    email: e.email,
    name: e.name,
    avatarUrl: e.avatar_url,
    headline: e.headline,
    role,
  });

  try {
    const { data: row } = await supabase
      .from("employees")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();

    if (row) {
      // The identity provider is the source of truth for name, photo and
      // email: they change there. Refresh on sign-in so stale profiles heal.
      const patch = {
        ...(picture && picture !== row.avatar_url ? { avatar_url: picture } : {}),
        ...(name && name !== row.name ? { name } : {}),
        ...(email && email !== row.email ? { email } : {}),
      };
      if (Object.keys(patch).length === 0) return shape(row);

      const { data: updated } = await supabase
        .from("employees")
        .update(patch)
        .eq("id", user.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      // A failed refresh must never cost the user their session.
      return shape(updated ?? row);
    }

    if (!email) return virtualProfile;

    const { data: created, error: insertError } = await supabase
      .from("employees")
      .insert({ id: user.id, email, name, avatar_url: picture })
      .select(PROFILE_COLUMNS)
      .single();
    if (created) return shape(created);

    // Two first requests raced; the other one created the row.
    if (insertError?.code === "23505") {
      const { data: existing } = await supabase
        .from("employees")
        .select(PROFILE_COLUMNS)
        .eq("id", user.id)
        .maybeSingle();
      if (existing) return shape(existing);
    }
    return virtualProfile;
  } catch {
    return virtualProfile;
  }
});

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
