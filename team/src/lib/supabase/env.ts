// Supabase project settings. Both are public by design: the browser needs them,
// and row-level security in supabase/migrations decides what each user can do.
// NEXT_PUBLIC_* names must be written out literally so Next.js inlines them.

export interface SupabaseConfig {
  url: string;
  key: string;
}

export function supabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // The legacy "anon" key also works for as long as Supabase still accepts it.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Supabase → Project Settings → API keys) " +
        "in team/.env.local or your hosting provider. See team/docs/setup.md.",
    );
  }
  return { url, key };
}
