import * as XLSX from "xlsx";

// LinkedIn single-post analytics export. Sample layout:
//   A1:"Post URL"            B1: <url>
//   A2:"Post Date"           B2: <date or "10/19/2025">
//   A3:"Post Publish Time"   B3: <time text e.g. "7:00 AM">
//   ...
//   A6:"Impressions"         B6: <number>
//   A7:"Members reached"     B7: <number>
//   (demographic blocks — ignored)
//
// Layout varies between exports — sometimes one sheet, sometimes two
// (e.g. "Performance" + "Demographics"). We don't depend on a specific sheet
// name or row positions. Instead we walk every sheet, build a label→value
// map from column A/B, and pick the first match for each expected label.

export interface ParsedPost {
  postUrl: string | null;
  postDate: string;          // YYYY-MM-DD
  postPublishTime: string | null;
  impressions: number;
  reach: number;
  sourceSheetName: string;
  raw: Record<string, unknown>;
}

export class LinkedInExportParseError extends Error {
  constructor(public readonly code: ExportErrorCode, message: string) {
    super(message);
    this.name = "LinkedInExportParseError";
  }
}

export type ExportErrorCode =
  | "missing_post_url"
  | "missing_post_date"
  | "invalid_post_date"
  | "missing_impressions"
  | "missing_reach"
  | "non_numeric_impressions"
  | "non_numeric_reach"
  | "empty_workbook"
  | "read_failed";

const LABELS = {
  postUrl: ["post url"],
  postDate: ["post date"],
  postPublishTime: ["post publish time"],
  impressions: ["impressions"],
  // LinkedIn calls it "Members reached" — that's our reach.
  reach: ["members reached", "reach"],
} as const;

export async function parsePostExport(file: File | Blob | ArrayBuffer): Promise<ParsedPost> {
  let buf: ArrayBuffer;
  try {
    buf = file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  } catch (e) {
    throw new LinkedInExportParseError("read_failed", "Could not read the uploaded file.");
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch {
    throw new LinkedInExportParseError("read_failed", "File is not a valid Excel workbook.");
  }

  if (wb.SheetNames.length === 0) {
    throw new LinkedInExportParseError("empty_workbook", "The workbook has no sheets.");
  }

  // Scan every sheet, build a single label→value map. First non-empty value
  // wins — exports occasionally repeat labels in different blocks, and the
  // headline metrics are always in the first occurrence.
  const lookup = new Map<string, unknown>();
  let postUrlSheet: string | null = null;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
    if (postUrlSheet == null && rows.some((r) => isLabel(r?.[0], LABELS.postUrl))) {
      postUrlSheet = name;
    }
    addToLabelLookup(lookup, rows);
  }
  if (lookup.size === 0) {
    throw new LinkedInExportParseError("empty_workbook", "The workbook is empty.");
  }

  const postUrlRaw = pickFirst(lookup, LABELS.postUrl);
  if (postUrlRaw == null || String(postUrlRaw).trim() === "") {
    throw new LinkedInExportParseError(
      "missing_post_url",
      "Could not find the Post URL. The export does not look like a LinkedIn post analytics file.",
    );
  }

  const postDateRaw = pickFirst(lookup, LABELS.postDate);
  if (postDateRaw == null || (typeof postDateRaw === "string" && postDateRaw.trim() === "")) {
    throw new LinkedInExportParseError("missing_post_date", "Post Date is missing from the export.");
  }
  const postDate = parsePostDate(postDateRaw);
  if (!postDate) {
    throw new LinkedInExportParseError(
      "invalid_post_date",
      `Could not understand the Post Date value: "${String(postDateRaw)}".`,
    );
  }

  const publishTimeRaw = pickFirst(lookup, LABELS.postPublishTime);
  const postPublishTime =
    publishTimeRaw == null || publishTimeRaw === "" ? null : String(publishTimeRaw).trim();

  const impressionsRaw = pickFirst(lookup, LABELS.impressions);
  if (impressionsRaw == null || impressionsRaw === "") {
    throw new LinkedInExportParseError("missing_impressions", "Impressions value is missing.");
  }
  const impressions = parseIntSafe(impressionsRaw);
  if (impressions == null) {
    throw new LinkedInExportParseError(
      "non_numeric_impressions",
      `Impressions value is not a number: "${String(impressionsRaw)}".`,
    );
  }

  const reachRaw = pickFirst(lookup, LABELS.reach);
  if (reachRaw == null || reachRaw === "") {
    throw new LinkedInExportParseError(
      "missing_reach",
      "Members reached value is missing from the export.",
    );
  }
  const reach = parseIntSafe(reachRaw);
  if (reach == null) {
    throw new LinkedInExportParseError(
      "non_numeric_reach",
      `Members reached value is not a number: "${String(reachRaw)}".`,
    );
  }

  return {
    postUrl: normalizePostUrl(String(postUrlRaw)),
    postDate,
    postPublishTime,
    impressions,
    reach,
    sourceSheetName: postUrlSheet ?? wb.SheetNames[0] ?? "",
    raw: {
      postUrl: String(postUrlRaw),
      postDate: String(postDateRaw),
      postPublishTime: publishTimeRaw == null ? null : String(publishTimeRaw),
      impressions: String(impressionsRaw),
      reach: String(reachRaw),
    },
  };
}

/**
 * Strip tracking query params and trailing slashes so the same LinkedIn post
 * exported by two people compares equal. Preserves URL casing (LinkedIn URNs
 * are case-sensitive in the path).
 */
export function normalizePostUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.search = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return trimmed.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

/**
 * Add every "label in column A → value in column B" entry from `rows` into the
 * shared lookup map. First non-empty value for each label wins, so a later
 * sheet can't clobber a value already captured from an earlier one.
 */
function addToLabelLookup(out: Map<string, unknown>, rows: unknown[][]): void {
  for (const row of rows) {
    const label = String(row?.[0] ?? "").trim().toLowerCase();
    if (!label) continue;
    const value = row?.[1] ?? null;
    if (value === null || value === "") continue;
    if (!out.has(label)) out.set(label, value);
  }
}

function isLabel(cell: unknown, candidates: readonly string[]): boolean {
  const v = String(cell ?? "").trim().toLowerCase();
  return candidates.includes(v);
}

function pickFirst(lookup: Map<string, unknown>, candidates: readonly string[]): unknown {
  for (const c of candidates) {
    const v = lookup.get(c);
    if (v != null && v !== "") return v;
  }
  return null;
}

/** Parse impressions/reach from any of: number, "1,234", "  42 ". */
function parseIntSafe(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const cleaned = String(v).replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Parse a post date safely, accepting:
 * - Excel-parsed Date objects (when xlsx returns cellDates: true)
 * - Strings like "10/19/2025" (MM/DD/YYYY) — LinkedIn's default
 * - Strings like "2025-10-19" (ISO)
 *
 * Returns YYYY-MM-DD string, or null if unparseable.
 */
function parsePostDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;

  // US MM/DD/YYYY (LinkedIn default — sample shows 10/19/2025)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Fallback: let JS try to parse it.
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
