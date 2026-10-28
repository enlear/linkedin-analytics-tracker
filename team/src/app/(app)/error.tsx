"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Route-segment error boundary for everything under (app)/. In production
// Next.js hides server-component error messages by default and shows only a
// digest; surfacing them here makes the deployed app debuggable without
// needing access to the host's logs.
export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-4">
      <h1 className="text-xl font-semibold">Something went wrong loading this page</h1>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
        <div className="font-medium">{error.message || "Unknown error"}</div>
        {error.digest ? (
          <div className="text-xs text-muted-foreground">Digest: {error.digest}</div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/login">Sign out & sign in</a>
        </Button>
      </div>
    </div>
  );
}
