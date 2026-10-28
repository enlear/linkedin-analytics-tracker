import * as XLSX from "xlsx";

// Cell helpers shared by the company-page export parsers.

export type CompanyImportErrorCode = "invalid_arg" | "missing_sheet" | "parse_failed" | "empty_file";

export class CompanyImportError extends Error {
  constructor(
    public readonly code: CompanyImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompanyImportError";
  }
}

export interface ReportMonth {
  /** First of the month, as the `date` column stores it: "2026-05-01". */
  reportMonth: string;
  /** "2026-05", for grouping stored files. */
  monthKey: string;
  monthLabel: string;
  year: number;
}

/** Accepts "YYYY-MM" or "YYYY-MM-DD"; any day is normalised to the 1st. */
export function parseReportMonth(value: string): ReportMonth | null {
  const m = String(value).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return {
    reportMonth: `${m[1]}-${m[2]}-01`,
    monthKey: `${m[1]}-${m[2]}`,
    monthLabel: new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    year,
  };
}

/** Anything the parse throws that isn't already a CompanyImportError becomes parse_failed. */
export function parseWorkbook<T>(data: ArrayBuffer, read: (wb: XLSX.WorkBook) => T): T {
  try {
    return read(XLSX.read(data, { type: "array", cellDates: true }));
  } catch (e) {
    if (e instanceof CompanyImportError) throw e;
    throw new CompanyImportError("parse_failed", e instanceof Error ? e.message : "Could not parse the file.");
  }
}

export function readSheet(
  wb: XLSX.WorkBook,
  name: string,
  opts: { headerRow?: number; anyCase?: boolean } = {},
): Record<string, unknown>[] {
  let sheet = wb.Sheets[name];
  if (!sheet && opts.anyCase) {
    const match = wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
    if (match) sheet = wb.Sheets[match];
  }
  if (!sheet) {
    throw new CompanyImportError(
      "missing_sheet",
      `Sheet "${name}" not found. Found sheets: ${wb.SheetNames.join(", ")}`,
    );
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: opts.headerRow ?? 0,
    defval: null,
    raw: true,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Date cell → "YYYY-MM-DD", or null when it isn't a date. `fallbackYear`
 * enables TikTok's year-less "April 1" form; without it that text goes
 * through the generic Date parse like any other string.
 */
export function parseDateCell(v: unknown, fallbackYear?: number): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    // SheetJS builds date cells in local time, so read them back the same way.
    return toIsoDate(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  }
  if (typeof v === "number") {
    // Excel serial date (days since 1900) in a cell without a date format.
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  if (!s) return null;

  if (fallbackYear !== undefined) {
    const monthDay = s.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    const monthIndex = monthDay ? MONTH_NAMES.indexOf(monthDay[1].toLowerCase()) : -1;
    if (monthDay && monthIndex !== -1) {
      return `${fallbackYear}-${pad(monthIndex + 1)}-${pad(Number(monthDay[2]))}`;
    }
  }

  // mm/dd/yyyy
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return `${year}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toIsoDate(d);
  return null;
}

export function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function intNum(v: unknown): number {
  return Math.round(num(v));
}

export function textOrNull(v: unknown): string | null {
  return v ? String(v).trim() : null;
}
