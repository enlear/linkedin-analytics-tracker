// Admin-only in-app documentation.
//
// Each entry is a self-contained reference document rendered at /docs/<slug>.
// Bodies are plain (server-renderable) components so they can pull live values
// straight from the source of truth — e.g. the Performance Score doc reads the
// real weight constants from `@/lib/period`, so the docs can't drift from code.
//
// To add a doc: write a Body component below and append it to DOCS.

import type { ComponentType } from "react";
import { Trophy, CalendarRange, FileSpreadsheet } from "lucide-react";
import { CONSISTENCY_WEIGHT, CONTENT_WEIGHT, QUALITY_WEIGHT } from "@/lib/period";
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_WEIGHT } from "@/lib/post-categories";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  Body: ComponentType;
}

// ---------------------------------------------------------------------------
// Shared presentational helpers — keep every doc visually consistent.
// ---------------------------------------------------------------------------

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground mt-6 first:mt-0">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-foreground text-[13px]">{children}</code>;
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-md bg-muted p-3 text-xs text-foreground overflow-x-auto">{children}</pre>
  );
}

function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
      {children}
    </ol>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
      {children}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Doc: Performance Score
// ---------------------------------------------------------------------------

function PerformanceScoreDoc() {
  const qualityPct = Math.round(QUALITY_WEIGHT * 100);
  const consistencyPct = Math.round(CONSISTENCY_WEIGHT * 100);
  const contentPct = Math.round(CONTENT_WEIGHT * 100);
  return (
    <div className="space-y-3">
      <P>
        The monthly winner is determined by a <Strong>Performance Score</Strong> on a 0–1 scale,
        rather than by average reach alone. Average reach can be skewed by a single high-performing
        post, so the score evaluates each employee{" "}
        <Strong>relative to that month&apos;s participants</Strong> across three dimensions:
      </P>
      <OL>
        <li>
          <Strong>Quality ({qualityPct}%)</Strong> — the <em>median</em> reach per post. Using the
          median rather than the average prevents a single outlier from distorting a typical
          performance.
        </li>
        <li>
          <Strong>Consistency ({consistencyPct}%)</Strong> — the number of valid posts submitted,
          rewarding sustained, regular activity.
        </li>
        <li>
          <Strong>Content ({contentPct}%)</Strong> — the average <em>category weight</em> of the
          posts. Employees tag every upload with a post type, and admins give each type a weight in
          Settings, so an article can count for more than an event update.
        </li>
      </OL>

      <H2>Post categories</H2>
      <P>
        Categories and weights are managed by admins under Settings → Post categories. The
        suggested starting set:
      </P>
      <Pre>
        {DEFAULT_CATEGORIES.map((c) => `${c.name.padEnd(16)} weight ${c.weight}`).join("\n")}
      </Pre>
      <P>
        Weights are read when the score is calculated, so changing one re-scores every month. Posts
        without a category (synced from the LinkedIn API, or whose category was deleted)
        count as weight {DEFAULT_CATEGORY_WEIGHT}. Archiving a category hides it from the upload
        form, and posts already filed under it keep its weight.
      </P>

      <H2>Calculation</H2>
      <P>
        Quality and consistency are normalised across the month&apos;s participants using min–max
        scaling (highest = 1.0, lowest = 0.0). Content is scaled as a ratio to the best in the
        field, because category weights sit close together and min–max would turn a small
        difference in post mix into a full 0-vs-1 swing. The three are then combined:
      </P>
      <Pre>
        {`qualityScaled     = (medianReach − minMedian) / (maxMedian − minMedian)
consistencyScaled = (postCount  − minCount ) / (maxCount  − minCount )
contentScaled     = avgCategoryWeight / maxAvgCategoryWeight

score = ${QUALITY_WEIGHT} × qualityScaled
      + ${CONSISTENCY_WEIGHT} × consistencyScaled
      + ${CONTENT_WEIGHT} × contentScaled`}
      </Pre>
      <P>
        When every participant ties on quality or consistency (the range is zero), that dimension
        scores 1.0 for everyone and contributes a constant.
      </P>

      <H2>Worked example</H2>
      <P>
        Four participants in a month, using the default weights. Bob&apos;s articles close
        most of the gap to Alice&apos;s single high-reach general post:
      </P>
      <Pre>
        {`Person  Median reach  Posts  Avg weight  Quality  Consistency  Content  Score
Alice           5000      1        1.00     1.00         0.00     0.50   0.66
Bob             3000      3        2.00     0.49         0.50     1.00   0.59
Dave            2600      2        1.50     0.38         0.25     0.75   0.43
Carol           1100      5        1.25     0.00         1.00     0.62   0.36`}
      </Pre>

      <H2>Tie-breaking & eligibility</H2>
      <UL>
        <li>Ties are resolved by median reach, then by total reach.</li>
        <li>Employees with no valid posts receive a score of 0 and are excluded from selection.</li>
        <li>Only accepted posts within the tracking period contribute.</li>
      </UL>

      <H2>For developers</H2>
      <P>
        Reference implementation: <Code>scoreEmployees()</Code> in <Code>src/lib/period.ts</Code>.
        Adjust the weighting via the <Code>QUALITY_WEIGHT</Code>,{" "}
        <Code>CONSISTENCY_WEIGHT</Code> and <Code>CONTENT_WEIGHT</Code> constants — the
        percentages and formula shown above are read
        from those constants, so this document stays in sync automatically.
      </P>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc: Tracking periods & winner selection
// ---------------------------------------------------------------------------

function TrackingPeriodsDoc() {
  return (
    <div className="space-y-3">
      <P>
        Performance is measured in monthly tracking periods. A period&apos;s{" "}
        <Strong>report month</Strong> is the later calendar month of its range, and a post is filed
        into a report month based on its post date.
      </P>

      <H2>Period boundaries (the day-20 rule)</H2>
      <UL>
        <li>
          A report month runs from the <Strong>20th of the previous month</Strong> to the{" "}
          <Strong>19th of the report month</Strong>. Example: the May 2026 period covers April 20 →
          May 19.
        </li>
        <li>
          A post is filed under the report month its <Strong>post date</Strong> falls into — a post
          dated on or after the 20th rolls into the next month&apos;s report.
        </li>
      </UL>

      <H2>Uploads are never date-gated</H2>
      <P>
        Employees can upload any post at any time — no upload is ever rejected for being late. Each
        upload is simply filed under whichever report month its post date lands in.
      </P>
      <P>
        Employees are <Strong>advised</Strong> to upload by the last day of the report month. That
        is guidance, not a gate: it is the point after which an upload no longer affects the
        ranking.
      </P>

      <H2>Winner selection</H2>
      <UL>
        <li>
          The winner is selected on the <Strong>last day of the report&apos;s calendar month</Strong>{" "}
          (e.g. the May winner is picked on May 31, February on the 28th or 29th, April on the
          30th).
        </li>
        <li>
          Ranking <Strong>freezes at the end of that day</Strong> — precisely, 00:00 on the 1st of
          the next month in the app timezone. The whole of the last day is usable, and the result is
          settled the moment the 1st begins.
        </li>
        <li>
          A post counts toward the winner only if it was <Strong>uploaded before that instant</Strong>.
          Posts uploaded afterwards still belong to the month and still appear in its stats so
          employees can track their progress — they are marked with an asterisk and excluded from
          every ranked figure, so a closed month&apos;s podium can never move.
        </li>
        <li>Only posts whose post date falls inside the period&apos;s range are counted.</li>
        <li>
          Ranking uses the <Strong>Performance Score</Strong> — see the Performance Score document.
        </li>
      </UL>

      <H2>Note on &quot;current month&quot;</H2>
      <P>
        The dashboard&apos;s notion of the <Strong>current month</Strong> tracks the calendar month
        (on May 26 it still shows &quot;May 2026&quot;), which is intentionally separate from where
        an individual post is filed under the day-20 rule.
      </P>

      <H2>For developers</H2>
      <P>
        All period math lives in <Code>src/lib/period.ts</Code> (<Code>buildPeriod</Code>,{" "}
        <Code>getCurrentTrackingPeriod</Code>, <Code>getTrackingPeriodForDate</Code>). All
        &quot;today&quot; calculations use <Code>APP_TIMEZONE</Code> (defaults to UTC).
      </P>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc: Upload validation
// ---------------------------------------------------------------------------

function UploadValidationDoc() {
  return (
    <div className="space-y-3">
      <P>
        Employees upload the per-post analytics file exported from LinkedIn (an Excel workbook).
        The parser scans every sheet and reads the headline metrics from the label/value columns,
        so it doesn&apos;t depend on a specific sheet name or row layout.
      </P>

      <H2>Required fields</H2>
      <P>An upload is accepted only when all of these are present and valid:</P>
      <UL>
        <li>
          <Strong>Post URL</Strong> — identifies the post (also used for duplicate detection).
        </li>
        <li>
          <Strong>Post Date</Strong> — accepts ISO (<Code>2025-10-19</Code>), US{" "}
          <Code>MM/DD/YYYY</Code>, or Excel date values.
        </li>
        <li>
          <Strong>Impressions</Strong> — numeric (commas are tolerated, e.g. <Code>1,234</Code>).
        </li>
        <li>
          <Strong>Members reached</Strong> — numeric; stored as the post&apos;s{" "}
          <Strong>reach</Strong>.
        </li>
      </UL>
      <P>
        Post Publish Time is captured when present but is optional. Demographic blocks in the export
        are ignored.
      </P>

      <H2>Post category</H2>
      <P>
        Before uploading, the employee must pick a <Strong>post type</Strong> (for example Medium
        article, Direct post, Event update, or Other). The category feeds the Content part of the
        Performance Score. An upload naming an unknown or archived category is rejected.
      </P>

      <H2>Duplicate handling</H2>
      <UL>
        <li>
          The same <Strong>post URL</Strong> can be submitted only once across the whole team.
        </li>
        <li>
          A repeat upload is rejected with a message indicating whether the duplicate was the
          employee&apos;s own post or a teammate&apos;s. URLs are normalised (tracking params and
          trailing slashes stripped) before comparison.
        </li>
      </UL>

      <H2>Rejections</H2>
      <P>
        When a file is missing a required field, has a non-numeric metric, isn&apos;t a valid
        workbook, is a duplicate, or names an unavailable category, the upload is recorded as <Strong>rejected</Strong> with a
        reason and surfaced in the activity log. The file is read in memory on the server and never
        stored, whether the upload succeeds or is rejected.
      </P>

      <H2>For developers</H2>
      <P>
        Parsing logic: <Code>src/lib/linkedin/parse-export.ts</Code>, called by the upload server
        action in <Code>src/app/(app)/upload/actions.ts</Code>.
      </P>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const DOCS: DocMeta[] = [
  {
    slug: "performance-score",
    title: "Performance Score",
    description: "How the monthly winner is calculated — quality, consistency and content, normalised.",
    icon: Trophy,
    Body: PerformanceScoreDoc,
  },
  {
    slug: "tracking-periods",
    title: "Tracking periods & winner selection",
    description: "The day-20 month boundaries, post filing, and when the winner is picked.",
    icon: CalendarRange,
    Body: TrackingPeriodsDoc,
  },
  {
    slug: "upload-validation",
    title: "Upload validation",
    description: "Required fields in a LinkedIn export, accepted formats, and duplicate handling.",
    icon: FileSpreadsheet,
    Body: UploadValidationDoc,
  },
];

export function getDoc(slug: string): DocMeta | null {
  return DOCS.find((d) => d.slug === slug) ?? null;
}
