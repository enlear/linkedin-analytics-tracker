// Next.js 15 instrumentation hook — fires for any unhandled error in a
// server component, route handler, or middleware. We use it to log the
// unsanitized error (which the framework otherwise hides in production)
// so it can be found by digest.
//
// Read it in your host's function logs (Vercel: Logs, Netlify: Functions →
// logs): search for "[serverError]" or the digest from the error page.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string },
) {
  const e = err as { message?: string; stack?: string; digest?: string; name?: string };
  console.error("[serverError]", {
    digest: e?.digest ?? null,
    name: e?.name ?? null,
    message: e?.message ?? String(err),
    stack: e?.stack ?? null,
    routePath: context?.routePath,
    routerKind: context?.routerKind,
    method: request?.method,
    requestPath: request?.path,
  });
}
