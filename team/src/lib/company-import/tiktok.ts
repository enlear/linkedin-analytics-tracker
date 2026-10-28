import type { DailyRowInput, TiktokDailyMetricRecord } from "@/lib/supabase/database.types";
import { CompanyImportError, intNum, parseDateCell, parseReportMonth, parseWorkbook, readSheet } from "./shared";

// Parser for TikTok's analytics export: one "Overview" sheet, headers on the
// first row, one row per day.

export type TiktokDailyRow = DailyRowInput<TiktokDailyMetricRecord>;

/**
 * `reportMonth` ("YYYY-MM" or "YYYY-MM-DD") supplies the year, because TikTok
 * writes dates as "April 1". Throws CompanyImportError.
 */
export function parseTiktokExport(data: ArrayBuffer, reportMonth: string): TiktokDailyRow[] {
  const month = parseReportMonth(reportMonth);
  if (!month) throw new CompanyImportError("invalid_arg", "reportMonth must be YYYY-MM-DD format.");

  // TikTok sometimes ships the sheet as "overview".
  const rows = parseWorkbook(data, (wb) =>
    parseOverviewSheet(readSheet(wb, "Overview", { anyCase: true }), month.year),
  );
  if (rows.length === 0) {
    throw new CompanyImportError(
      "empty_file",
      "No data rows found. Expected an 'Overview' sheet with a Date column.",
    );
  }
  return rows;
}

function parseOverviewSheet(rows: Record<string, unknown>[], fallbackYear: number): TiktokDailyRow[] {
  return rows.flatMap((row): TiktokDailyRow[] => {
    const date = parseDateCell(row["Date"], fallbackYear);
    if (!date) return [];
    return [
      {
        date,
        video_views: intNum(row["Video Views"]),
        profile_views: intNum(row["Profile Views"]),
        likes: intNum(row["Likes"]),
        comments: intNum(row["Comments"]),
        shares: intNum(row["Shares"]),
      },
    ];
  });
}
