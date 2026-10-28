import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { fetchAllPostsForEmployee } from "@/lib/monthly-stats";
import {
  fetchMetaConnection,
  type MetaConnectionRow,
} from "@/lib/data/company-analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetaConnectionForm } from "./meta-connection-form";
import { PostCategoriesManager } from "./post-categories-manager";
import { fetchPostCategories } from "@/lib/data/post-categories";
import { CONTENT_WEIGHT } from "@/lib/period";

export default async function SettingsPage() {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");

  const uploads =
    me.role === "admin"
      ? []
      : (await fetchAllPostsForEmployee(me.id))
          .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))
          .slice(0, 20);

  const categories = me.role === "admin" ? await fetchPostCategories() : [];

  // Defensive — pre-deploy schema doesn't have MetaConnection; render the
  // rest of the page with a banner instead of crashing.
  let metaConnection: MetaConnectionRow | null = null;
  let metaError: string | null = null;
  if (me.role === "admin") {
    try {
      metaConnection = await fetchMetaConnection();
    } catch (e) {
      console.error("[settings] fetchMetaConnection failed:", e);
      metaError = e instanceof Error ? e.message : "Could not load Meta connection.";
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Your account and upload history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={me.name ?? "—"} />
          <Row label="Email" value={me.email ?? "—"} />
          <Row label="Role" value={me.role} />
        </CardContent>
      </Card>

      {me.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post categories</CardTitle>
            <CardDescription>
              Employees pick one of these for every upload. A category&apos;s weight drives the
              Content part ({Math.round(CONTENT_WEIGHT * 100)}%) of the Performance Score —
              higher weight, more credit. Edits apply to every month straight away. Archive a
              category to hide it from uploads; posts already filed under it keep their weight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PostCategoriesManager categories={categories} />
          </CardContent>
        </Card>
      ) : null}

      {me.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facebook connection</CardTitle>
            <CardDescription>
              Connect a Facebook Page to auto-fetch monthly Page Insights
              instead of uploading an export. The token stays in your database
              and is never sent back to a browser — only the server-side
              Graph API fetch can read it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metaError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {metaError}
              </div>
            ) : (
              <MetaConnectionForm existing={metaConnection} />
            )}
          </CardContent>
        </Card>
      ) : null}

      {me.role !== "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload history</CardTitle>
            <CardDescription>Your 20 most recent post uploads.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {uploads.length > 0 ? (
              <div className="divide-y divide-border">
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="px-6 py-3 flex items-start justify-between gap-4 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.file_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Uploaded {format(parseISO(u.uploaded_at), "MMM d, yyyy 'at' h:mm a")}
                        {" · "}Posted {u.post_date}
                      </div>
                      {u.post_url ? (
                        <a
                          href={u.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground truncate block mt-0.5"
                        >
                          {u.post_url}
                        </a>
                      ) : null}
                      {u.validation_status === "rejected" && u.rejection_reason ? (
                        <div className="text-xs text-destructive mt-1">{u.rejection_reason}</div>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {u.validation_status === "accepted" ? (
                        <Badge variant="success">Accepted</Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                      <div className="mt-2">{u.reach.toLocaleString()} reach</div>
                      <div>{u.impressions.toLocaleString()} impressions</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">No uploads yet.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
