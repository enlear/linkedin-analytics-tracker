import { supabaseConfig } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

interface AuthSettings {
  emailEnabled: boolean;
  googleEnabled: boolean;
  signupEnabled: boolean;
}

/**
 * Which sign-in options the Supabase project has switched on, so the page
 * never offers a button that can't work. Turning Google on in the Supabase
 * dashboard shows its button within five minutes, no redeploy needed.
 */
async function fetchAuthSettings(): Promise<AuthSettings> {
  try {
    const { url, key } = supabaseConfig();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`auth settings ${res.status}`);
    const settings = (await res.json()) as {
      external?: Record<string, boolean>;
      disable_signup?: boolean;
    };
    return {
      // Off only when an admin disabled the Email provider (Google-only teams).
      emailEnabled: settings.external?.email !== false,
      googleEnabled: settings.external?.google === true,
      signupEnabled: settings.disable_signup !== true,
    };
  } catch {
    // Email is Supabase's default provider; just don't promise Google.
    return { emailEnabled: true, googleEnabled: false, signupEnabled: true };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  link: "That link couldn't be completed in this browser. If you just confirmed your email, sign in below.",
  oauth_failed: "Sign-in with Google didn't finish. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [settings, { error }] = await Promise.all([fetchAuthSettings(), searchParams]);
  return (
    <LoginForm
      emailEnabled={settings.emailEnabled}
      googleEnabled={settings.googleEnabled}
      signupEnabled={settings.signupEnabled}
      initialError={error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.link) : null}
    />
  );
}
