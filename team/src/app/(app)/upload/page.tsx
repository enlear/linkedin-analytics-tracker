import { redirect } from "next/navigation";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadForm } from "./upload-form";
import { LinkedInConnect } from "./linkedin-connect";
import { getCurrentTrackingPeriod, toIsoDate } from "@/lib/period";
import { LINKEDIN_API_ENABLED } from "@/lib/flags";
import { fetchLinkedInConnection } from "@/lib/data/linkedin-connection";
import { fetchPostCategories } from "@/lib/data/post-categories";
import { format } from "date-fns";

// Server actions run in this page's function. The LinkedIn API sync makes
// several calls per post, so allow it more than the host's default time.
export const maxDuration = 60;

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string; linkedin_error?: string }>;
}) {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  // Hard-block admins from uploading — defense in depth on top of sidebar/role UX.
  if (me.role === "admin") redirect("/dashboard");

  const period = getCurrentTrackingPeriod();
  const categories = (await fetchPostCategories()).filter((c) => c.active);

  // Experimental LinkedIn API connection (flag-gated, default off).
  const sp = await searchParams;
  const connection = LINKEDIN_API_ENABLED
    ? await fetchLinkedInConnection(me.id)
    : null;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Upload LinkedIn post analytics
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Upload any LinkedIn post analytics export, any time. Each post is
          filed under the report month its publish date falls in — posts dated
          through the 19th count toward that month; dated the 20th or later,
          they roll into the next.
        </p>
      </div>

      {LINKEDIN_API_ENABLED ? (
        <LinkedInConnect
          connection={connection}
          reportMonthIso={toIsoDate(period.reportMonth)}
          reportMonthLabel={period.label}
          callbackStatus={sp.linkedin}
          callbackError={sp.linkedin_error}
        />
      ) : null}

      {/* The dropzone is the job; the instructions are reference. Side by side
          from lg up so a wide screen isn't a tall scroll of two stacked cards. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Current tracking period — {period.label}
            </CardTitle>
            <CardDescription>
              Posts published {period.rangeLabel} count toward this report.
              Upload them by {format(period.uploadDeadline, "MMMM d, yyyy")} to
              be in the running — the winner is picked from everything uploaded
              by the end of that day and announced on{" "}
              {format(period.winnerDate, "MMMM d, yyyy")}. You can still upload
              afterwards; those posts are kept so you can track your progress,
              but they don&apos;t affect the winner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm
              periodLabel={period.label}
              rangeLabel={period.rangeLabel}
              periodStartIso={toIsoDate(period.start)}
              periodEndIso={toIsoDate(period.end)}
              categories={categories}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              How to get a post analytics file
            </CardTitle>
            <CardDescription>Takes under a minute per post.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 text-sm space-y-2 text-muted-foreground">
              <li>
                Open your LinkedIn post and click{" "}
                <span className="font-medium text-foreground">
                  View analytics
                </span>
                .
              </li>
              <li>
                Click{" "}
                <span className="font-medium text-foreground">Export</span> —
                LinkedIn downloads an{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  .xlsx
                </code>{" "}
                file with that post&apos;s impressions, reach, and metadata.
              </li>
              <li>
                Pick the{" "}
                <span className="font-medium text-foreground">post type</span>{" "}
                — articles, direct posts and event updates are weighted
                differently in the Performance Score.
              </li>
              <li>
                Drop that{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  .xlsx
                </code>{" "}
                file into the box above. Repeat for each post you want counted
                this month.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-4">
              Posts are deduplicated by post URL. Re-uploading the same post is
              safe — it will be ignored. Reach and impressions are read directly
              from the file and cannot be edited after upload.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
