import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import {
  fetchCompanyMetricsForUpload,
  fetchCompanyPostsForUpload,
  fetchFacebookMetricsForUpload,
  fetchInstagramMetricsForUpload,
  fetchTiktokMetricsForUpload,
  listCompanyUploads,
  type CompanyUploadSummary,
} from "@/lib/data/company-analytics";
import type { SocialPlatform } from "@/lib/social-platforms";
import {
  REPORT_PLATFORMS,
  buildOverview,
  facebookReport,
  instagramReport,
  linkedinReport,
  tiktokReport,
  type PlatformReport,
} from "@/lib/company-report";
import { CompanyReportBody, type ReportSource } from "@/components/reports/company-report-body";
import { PrintButton } from "../../[month]/print-button";

function monthName(year: number, month1: number, style: "long" | "short"): string {
  return new Date(Date.UTC(year, month1 - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    ...(style === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export default async function CompanyMonthlyReport({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const { month } = await params;
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) notFound();
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) notFound();
  const reportMonth = `${m[1]}-${m[2]}-01`;
  const prevYear = mon === 1 ? year - 1 : year;
  const prevMon = mon === 1 ? 12 : mon - 1;
  const prevReportMonth = `${prevYear}-${String(prevMon).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();

  // One upload per platform per month; the report covers every platform that
  // has one, and compares each against the same platform's previous month.
  const uploads = await listCompanyUploads();
  const find = (rm: string, p: SocialPlatform) =>
    uploads.find((u) => u.reportMonth === rm && u.platform === p);
  const cur = Object.fromEntries(REPORT_PLATFORMS.map((p) => [p, find(reportMonth, p)])) as Record<
    SocialPlatform,
    CompanyUploadSummary | undefined
  >;
  const prev = Object.fromEntries(
    REPORT_PLATFORMS.map((p) => [p, find(prevReportMonth, p)]),
  ) as Record<SocialPlatform, CompanyUploadSummary | undefined>;
  const present = REPORT_PLATFORMS.filter((p) => cur[p]);
  if (present.length === 0) notFound();

  const load = <T,>(u: CompanyUploadSummary | undefined, fn: (id: string) => Promise<T>) =>
    u ? fn(u.id) : Promise.resolve(null);
  const [liMetrics, liPosts, liPrevMetrics, liPrevPosts, ttCur, ttPrev, fbCur, fbPrev, igCur, igPrev] =
    await Promise.all([
      load(cur.linkedin, fetchCompanyMetricsForUpload),
      load(cur.linkedin, fetchCompanyPostsForUpload),
      load(prev.linkedin, fetchCompanyMetricsForUpload),
      load(prev.linkedin, fetchCompanyPostsForUpload),
      load(cur.tiktok, fetchTiktokMetricsForUpload),
      load(prev.tiktok, fetchTiktokMetricsForUpload),
      load(cur.facebook, fetchFacebookMetricsForUpload),
      load(prev.facebook, fetchFacebookMetricsForUpload),
      load(cur.instagram, fetchInstagramMetricsForUpload),
      load(prev.instagram, fetchInstagramMetricsForUpload),
    ]);

  const reports: PlatformReport[] = present.map((p) => {
    switch (p) {
      case "linkedin":
        return linkedinReport(
          { metrics: liMetrics ?? [], posts: liPosts ?? [] },
          liPrevMetrics ? { metrics: liPrevMetrics, posts: liPrevPosts ?? [] } : null,
          daysInMonth,
        );
      case "tiktok":
        return tiktokReport(ttCur ?? [], ttPrev, daysInMonth);
      case "facebook":
        return facebookReport(fbCur ?? [], fbPrev, daysInMonth);
      case "instagram":
        return instagramReport(igCur ?? [], igPrev, daysInMonth);
    }
  });

  const sources: Partial<Record<SocialPlatform, ReportSource>> = {};
  for (const p of present) {
    sources[p] = { fileName: cur[p]!.fileName, uploadedAt: cur[p]!.uploadedAt };
  }

  return (
    <div className="max-w-6xl space-y-6 print:space-y-4 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All reports
        </Link>
        <PrintButton />
      </div>

      <CompanyReportBody
        monthLabel={cur[present[0]]!.monthLabel}
        prevLong={monthName(prevYear, prevMon, "long")}
        prevShort={monthName(prevYear, prevMon, "short")}
        curShort={monthName(year, mon, "short")}
        reports={reports}
        overview={buildOverview(reports)}
        sources={sources}
        linkedin={cur.linkedin ? { metrics: liMetrics ?? [], posts: liPosts ?? [] } : null}
      />
    </div>
  );
}
