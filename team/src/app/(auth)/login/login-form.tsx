"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/browser";
import { siteConfig } from "@/site.config";

type Mode = "signIn" | "signUp" | "checkEmail";

interface LoginFormProps {
  emailEnabled: boolean;
  googleEnabled: boolean;
  signupEnabled: boolean;
  initialError: string | null;
}

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function LoginForm({
  emailEnabled,
  googleEnabled,
  signupEnabled,
  initialError,
}: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  // The middleware always lets /login render, so send a signed-in visitor on.
  // getUser checks with the auth server: a user an admin deleted still has a
  // well-formed cookie, so clear it locally instead of bouncing them to a
  // dashboard that can't load.
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data, error }) => {
      if (data.user) router.replace("/dashboard");
      else if (error) void supabase.auth.signOut({ scope: "local" });
    });
  }, [router]);

  async function handleGoogle() {
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // On success the browser is already navigating to Google.
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (!error) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    if (error.code === "email_not_confirmed") {
      setMode("checkEmail");
      toast.message("Confirm your email to finish signing up.");
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { name: name || email }, emailRedirectTo: callbackUrl() },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // No session means the project requires email confirmation.
    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      setMode("checkEmail");
    }
  }

  async function handleResend() {
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) toast.error(error.message);
    else toast.success("New link sent.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <Image
            src={siteConfig.logoUrl}
            alt=""
            unoptimized
            width={120}
            height={48}
            priority
            className="mx-auto h-12 w-auto"
          />
          <div>
            <CardTitle className="text-2xl">{siteConfig.name}</CardTitle>
            <CardDescription className="mt-2">
              {mode === "checkEmail" ? "Check your inbox to finish signing up." : siteConfig.description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled && mode !== "checkEmail" ? (
            <>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full"
                size="lg"
                variant="outline"
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              {emailEnabled ? (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {emailEnabled && mode === "signIn" ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <Button type="submit" disabled={loading} className="w-full">
                Sign in
              </Button>
              {signupEnabled ? (
                <p className="text-xs text-muted-foreground text-center">
                  Don&apos;t have an account?{" "}
                  <button type="button" className="underline" onClick={() => setMode("signUp")}>
                    Sign up
                  </button>
                </p>
              ) : null}
            </form>
          ) : null}

          {emailEnabled && mode === "signUp" ? (
            <form onSubmit={handleSignUp} className="space-y-3">
              <Field id="name" label="Name" type="text" value={name} onChange={setName} />
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <Button type="submit" disabled={loading} className="w-full">
                Create account
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have one?{" "}
                <button type="button" className="underline" onClick={() => setMode("signIn")}>
                  Sign in
                </button>
              </p>
            </form>
          ) : null}

          {mode === "checkEmail" ? (
            <div className="space-y-3 text-center">
              <MailCheck className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Open it
                on this device to finish signing in.
              </p>
              <p className="text-xs text-muted-foreground">
                <button type="button" className="underline" onClick={handleResend}>
                  Resend link
                </button>
                {" · "}
                <button type="button" className="underline" onClick={() => setMode("signIn")}>
                  Back to sign in
                </button>
              </p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
            We use Google or your email only to confirm your identity. Reach and engagement come
            from your weekly LinkedIn data export.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
