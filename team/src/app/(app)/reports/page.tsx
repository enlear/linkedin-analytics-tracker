import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, FileText } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPeriod, getCurrentTrackingPeriod } from "@/lib/period";
import {
  listCompanyUploads,
  type CompanyUploadSummary,
} from "@/lib/data/company-analytics";

const MONTHS_TO_LIST = 6;

export default async function ReportsIndex() {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const current = getCurrentTrackingPeriod();
  const periods = Array.from({ length: MONTHS_TO_LIST }).map((_, i) => {
    const m = current.reportMonth.getUTCMonth() - i;
    const y =
      m < 0
        ? current.reportMonth.getUTCFullYear() - 1
        : current.reportMonth.getUTCFullYear();
    return buildPeriod(y, ((m % 12) + 12) % 12);
  });

  // Defensive — same pattern as /company. If the company-analytics tables
  // aren't reachable yet, the rest of the page (employee reports) still
  // renders.
  let companyUploads: CompanyUploadSummary[] = [];
  try {
    companyUploads = await listCompanyUploads();
  } catch (e) {
    console.error("[reports] listCompanyUploads failed:", e);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Monthly reports</h1>
        <p className="text-muted-foreground mt-1">
          Open a month to view the report and save it as a PDF from the print dialog.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Employee performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {periods.map((p) => {
              const slug = `${p.reportMonth.getUTCFullYear()}-${String(
                p.reportMonth.getUTCMonth() + 1,
              ).padStart(2, "0")}`;
              return (
                <li key={slug} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Tracking period {p.rangeLabel}
                    </div>
                  </div>
                  <Link
                    href={`/reports/${slug}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open report →
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {companyUploads.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No company analytics uploaded yet. Upload one from the{" "}
              <Link href="/company" className="text-primary hover:underline">
                Company analytics
              </Link>{" "}
              page first.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {dedupeMonths(companyUploads).map(({ slug, monthLabel, platforms }) => (
                <li
                  key={slug}
                  className="px-6 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{monthLabel}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {platforms.join(" + ")}
                    </div>
                  </div>
                  <Link
                    href={`/reports/company/${slug}`}
                    className="text-sm font-medium text-primary hover:underline shrink-0"
                  >
                    Open report →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Group uploads by reportMonth across platforms — the report shows whichever
// platforms exist for the month in one unified PDF, so the index should have
// one row per month rather than one per upload.
function dedupeMonths(
  uploads: CompanyUploadSummary[],
): Array<{ slug: string; monthLabel: string; platforms: string[] }> {
  const byMonth = new Map<
    string,
    { slug: string; monthLabel: string; platforms: Set<string> }
  >();
  for (const u of uploads) {
    const slug = u.reportMonth.slice(0, 7);
    const existing = byMonth.get(slug);
    const label =
      u.platform === "linkedin"
        ? "LinkedIn"
        : u.platform === "tiktok"
          ? "TikTok"
          : u.platform === "facebook"
            ? "Facebook"
            : "Instagram";
    if (existing) {
      existing.platforms.add(label);
    } else {
      byMonth.set(slug, {
        slug,
        monthLabel: u.monthLabel,
        platforms: new Set([label]),
      });
    }
  }
  return [...byMonth.values()]
    .map((m) => ({
      slug: m.slug,
      monthLabel: m.monthLabel,
      platforms: [...m.platforms].sort(),
    }))
    .sort((a, b) => (a.slug < b.slug ? 1 : -1));
}
