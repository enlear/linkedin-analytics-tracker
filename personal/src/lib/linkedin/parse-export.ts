import * as XLSX from "xlsx";
import type {
  DailyEngagement,
  DailyFollowers,
  DateRange,
  DemographicEntry,
  IsoDate,
  ParsedExport,
  PostMetrics,
} from "./types";
import {
  type DateOrder,
  inferDateOrder,
  normalizeLabel,
  normalizePostUrl,
  parseDateCell,
  parseDateRange,
  parseNumber,
  parseShare,
} from "./values";

// Parser for the creator export at LinkedIn → Analytics → Content → Export.
//
// The workbook normally has five sheets — DISCOVERY, ENGAGEMENT, TOP POSTS,
// FOLLOWERS, DEMOGRAPHICS — but nothing here depends on sheet names, sheet
// order or cell positions. Each section is located by its header labels, in
// the sheet whose name matches first and then in every other sheet, so
// renamed sheets, moved tables and extra rows all still parse.
//
// English labels follow LinkedIn's export. Other languages are best-effort:
// add the labels from your own export to LABELS and send a PR.

type Grid = unknown[][];

export type ExportErrorCode =
  | "unreadable_file"
  | "empty_workbook"
  | "single_post_export"
  | "not_linkedin_export";

export class ExportParseError extends Error {
  constructor(
    public readonly code: ExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExportParseError";
  }
}

export const LABELS = {
  date: ["date", "datum", "fecha", "data"],
  impressions: ["impressions", "impressionen", "impresiones", "impressões", "impressioni"],
  engagements: ["engagements", "interaktionen", "interacciones", "interações", "interazioni"],
  membersReached: ["members reached", "erreichte mitglieder", "miembros alcanzados", "membros alcançados"],
  newFollowers: ["new followers", "neue follower", "nuevos seguidores", "novos seguidores", "nouveaux abonnés"],
  totalFollowersPrefix: ["total followers", "follower insgesamt", "seguidores totales", "total de seguidores"],
  postUrl: ["post url", "beitrags-url", "url de la publicación", "url da publicação"],
  publishDate: ["post publish date", "publish date", "veröffentlichungsdatum", "fecha de publicación"],
  demographicCategory: ["top demographics", "demographics", "category"],
  demographicValue: ["value", "wert", "valor", "valeur"],
  demographicShare: ["percentage", "percent", "prozentsatz", "porcentaje", "porcentagem", "pourcentage"],
} as const;

const SHEET_HINTS = {
  discovery: ["discovery"],
  engagement: ["engagement"],
  topPosts: ["top posts", "posts"],
  followers: ["followers"],
  demographics: ["demographics"],
} as const;

interface Sheet {
  name: string;
  grid: Grid;
}

/** Parse a LinkedIn Analytics → Content export (.xlsx). Throws ExportParseError. */
export function parseLinkedInExport(data: ArrayBuffer | Uint8Array): ParsedExport {
  let wb: XLSX.WorkBook;
  try {
    // cellDates off: real date cells come through as Excel serials, which
    // parseDateCell converts without any local-timezone shift.
    wb = XLSX.read(data, { type: "array", cellDates: false });
  } catch {
    throw new ExportParseError(
      "unreadable_file",
      "This file couldn't be opened as a spreadsheet. Upload the .xlsx file exactly as LinkedIn downloaded it.",
    );
  }

  const sheets: Sheet[] = wb.SheetNames.map((name) => ({
    name,
    grid: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }),
  })).filter((s) => s.grid.some((row) => row.some((c) => c != null && c !== "")));

  if (sheets.length === 0) {
    throw new ExportParseError("empty_workbook", "The spreadsheet is empty.");
  }

  const warnings: string[] = [];
  const order = workbookDateOrder(sheets);
  const summary = parseDiscovery(ordered(sheets, SHEET_HINTS.discovery), order);
  const daily = parseEngagement(ordered(sheets, SHEET_HINTS.engagement), order);
  const followers = parseFollowers(ordered(sheets, SHEET_HINTS.followers), order);
  const posts = parseTopPosts(ordered(sheets, SHEET_HINTS.topPosts), order);
  const demographics = parseDemographics(ordered(sheets, SHEET_HINTS.demographics));

  const found =
    summary.impressions != null ||
    summary.membersReached != null ||
    daily.length > 0 ||
    posts.length > 0 ||
    followers.total != null ||
    followers.daily.length > 0 ||
    demographics.length > 0;

  if (!found) {
    if (looksLikeSinglePostExport(sheets)) {
      throw new ExportParseError(
        "single_post_export",
        "This is a single-post analytics file. Export your account analytics instead: Analytics → Content → Export.",
      );
    }
    throw new ExportParseError(
      "not_linkedin_export",
      `This doesn't look like a LinkedIn content analytics export. Found sheets: ${sheets
        .map((s) => `"${s.name}"`)
        .join(", ")}. Expected sheets such as DISCOVERY, ENGAGEMENT, TOP POSTS, FOLLOWERS and DEMOGRAPHICS.`,
    );
  }

  if (daily.length === 0) warnings.push("No daily impressions/engagements found (ENGAGEMENT sheet).");
  if (posts.length === 0) warnings.push("No posts found (TOP POSTS sheet).");
  if (followers.total == null && followers.daily.length === 0) {
    warnings.push("No follower data found (FOLLOWERS sheet).");
  }
  if (demographics.length === 0) warnings.push("No audience demographics found (DEMOGRAPHICS sheet).");

  return {
    period: summary.period ?? rangeOf(daily.map((d) => d.date)),
    summary: { impressions: summary.impressions, membersReached: summary.membersReached },
    daily,
    followers,
    posts,
    demographics,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function parseDiscovery(sheets: Sheet[], order: DateOrder): {
  period: DateRange | null;
  impressions: number | null;
  membersReached: number | null;
} {
  for (const { grid } of sheets) {
    let period: DateRange | null = null;
    let impressions: number | null = null;
    let membersReached: number | null = null;
    for (const row of grid) {
      const label = normalizeLabel(row[0]);
      const value = firstFilled(row, 1);
      period ??= row.map((c) => parseDateRange(c, order)).find((r) => r != null) ?? null;
      if (matches(label, LABELS.impressions)) impressions ??= parseNumber(value);
      if (matches(label, LABELS.membersReached)) membersReached ??= parseNumber(value);
    }
    // Only trust a sheet that has the reach label — a bare "Impressions" in
    // column A could be a table header elsewhere.
    if (membersReached != null) return { period, impressions, membersReached };
  }
  return { period: null, impressions: null, membersReached: null };
}

function parseEngagement(sheets: Sheet[], order: DateOrder): DailyEngagement[] {
  for (const { grid } of sheets) {
    const table = findTable(grid, { date: LABELS.date, impressions: LABELS.impressions });
    if (!table) continue;
    const engagementsCol = table.headers.findIndex((h) => matches(h, LABELS.engagements));
    const rows = rowsBelow(grid, table.row, table.cols.date);
    const byDate = new Map<IsoDate, DailyEngagement>();
    for (const r of rows) {
      const date = parseDateCell(r[table.cols.date], order);
      if (!date) continue;
      byDate.set(date, {
        date,
        impressions: parseNumber(r[table.cols.impressions]) ?? 0,
        engagements: engagementsCol === -1 ? 0 : (parseNumber(r[engagementsCol]) ?? 0),
      });
    }
    if (byDate.size > 0) return sortByDate([...byDate.values()]);
  }
  return [];
}

function parseFollowers(sheets: Sheet[], order: DateOrder): ParsedExport["followers"] {
  let total: number | null = null;
  let totalAsOf: IsoDate | null = null;
  let daily: DailyFollowers[] = [];

  for (const { grid } of sheets) {
    if (total == null) {
      for (const row of grid) {
        const idx = row.findIndex((c) =>
          LABELS.totalFollowersPrefix.some((p) => normalizeLabel(c).startsWith(p)),
        );
        if (idx === -1) continue;
        total = parseNumber(firstFilled(row, idx + 1));
        // "Total followers on 10/27/2025:" — the date lives in the label.
        const dateText = String(row[idx]).match(/(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4})/)?.[1];
        totalAsOf = dateText ? parseDateCell(dateText, order) : null;
        break;
      }
    }

    if (daily.length === 0) {
      const table = findTable(grid, { date: LABELS.date, newFollowers: LABELS.newFollowers });
      if (table) {
        const rows = rowsBelow(grid, table.row, table.cols.date);
        const byDate = new Map<IsoDate, DailyFollowers>();
        for (const r of rows) {
          const date = parseDateCell(r[table.cols.date], order);
          if (date) byDate.set(date, { date, newFollowers: parseNumber(r[table.cols.newFollowers]) ?? 0 });
        }
        daily = sortByDate([...byDate.values()]);
      }
    }
    if (total != null && daily.length > 0) break;
  }
  return { total, totalAsOf, daily };
}

/**
 * TOP POSTS holds two tables side by side — top posts by engagements and top
 * posts by impressions — each with its own Post URL column. Every Post URL
 * column found starts one table; its metric is whichever known metric header
 * sits to its right before the next table begins.
 */
function parseTopPosts(sheets: Sheet[], order: DateOrder): PostMetrics[] {
  for (const { grid } of sheets) {
    const headerRow = grid.findIndex((row) => row.some((c) => matches(normalizeLabel(c), LABELS.postUrl)));
    if (headerRow === -1) continue;
    const headers = grid[headerRow].map(normalizeLabel);
    const urlCols = headers.flatMap((h, i) => (matches(h, LABELS.postUrl) ? [i] : []));

    const posts = new Map<string, PostMetrics>();
    for (const [n, urlCol] of urlCols.entries()) {
      const end = urlCols[n + 1] ?? headers.length;
      const colOf = (labels: readonly string[]) => {
        for (let i = urlCol + 1; i < end; i++) if (matches(headers[i], labels)) return i;
        return -1;
      };
      const dateCol = colOf(LABELS.publishDate);
      const impressionsCol = colOf(LABELS.impressions);
      const engagementsCol = colOf(LABELS.engagements);

      const rows = rowsBelow(grid, headerRow, urlCol);
      for (const r of rows) {
        const rawUrl = String(r[urlCol] ?? "").trim();
        if (!/^https?:\/\//i.test(rawUrl)) continue;
        const url = normalizePostUrl(rawUrl);
        const post = posts.get(url) ?? { url, publishedOn: null, impressions: null, engagements: null };
        if (dateCol !== -1) post.publishedOn ??= parseDateCell(r[dateCol], order);
        if (impressionsCol !== -1) post.impressions ??= parseNumber(r[impressionsCol]);
        if (engagementsCol !== -1) post.engagements ??= parseNumber(r[engagementsCol]);
        posts.set(url, post);
      }
    }
    if (posts.size > 0) return [...posts.values()];
  }
  return [];
}

function parseDemographics(sheets: Sheet[]): DemographicEntry[] {
  for (const { grid } of sheets) {
    const table = findTable(grid, {
      category: LABELS.demographicCategory,
      value: LABELS.demographicValue,
    });
    if (!table) continue;
    const shareCol = table.headers.findIndex((h) => matches(h, LABELS.demographicShare));
    if (shareCol === -1) continue;

    const entries: DemographicEntry[] = [];
    let category = "";
    for (const r of grid.slice(table.row + 1)) {
      // Category cells may be merged/blank for follow-on rows — carry it down.
      const cat = String(r[table.cols.category] ?? "").trim();
      if (cat) category = cat;
      const value = String(r[table.cols.value] ?? "").trim();
      const share = parseShare(r[shareCol]);
      if (category && value && share != null) entries.push({ category, value, share });
    }
    if (entries.length > 0) return entries;
  }
  return [];
}

/**
 * One date order for the whole workbook. A short column (a few post dates)
 * is often ambiguous on its own, but the long daily series in the same file
 * settles it. Date tokens are fed column by column so runs of consecutive
 * days stay adjacent for inferDateOrder's sequence check.
 */
function workbookDateOrder(sheets: Sheet[]): DateOrder {
  const tokens: string[] = [];
  for (const { grid } of sheets) {
    const width = Math.max(0, ...grid.map((r) => r.length));
    for (let col = 0; col < width; col++) {
      for (const row of grid) {
        const cell = row[col];
        if (typeof cell === "string") tokens.push(...(cell.match(DATE_TOKEN) ?? []));
      }
    }
  }
  return inferDateOrder(tokens);
}

const DATE_TOKEN = /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g;

function looksLikeSinglePostExport(sheets: Sheet[]): boolean {
  const labels = new Set(sheets.flatMap((s) => s.grid.map((r) => normalizeLabel(r[0]))));
  return labels.has("post url") && (labels.has("post date") || labels.has("post publish time"));
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

function matches(label: string, candidates: readonly string[]): boolean {
  return candidates.includes(label);
}

/** Sheets whose name matches a hint first, then the rest (content fallback). */
function ordered(sheets: Sheet[], hints: readonly string[]): Sheet[] {
  const hinted = (s: Sheet) => hints.some((h) => normalizeLabel(s.name).includes(h));
  return [...sheets.filter(hinted), ...sheets.filter((s) => !hinted(s))];
}

/** First row containing every required header; returns each one's column. */
function findTable<K extends string>(
  grid: Grid,
  required: Record<K, readonly string[]>,
): { row: number; headers: string[]; cols: Record<K, number> } | null {
  for (let row = 0; row < grid.length; row++) {
    const headers = grid[row].map(normalizeLabel);
    const cols = {} as Record<K, number>;
    let ok = true;
    for (const key of Object.keys(required) as K[]) {
      const idx = headers.findIndex((h) => matches(h, required[key]));
      if (idx === -1) {
        ok = false;
        break;
      }
      cols[key] = idx;
    }
    if (ok) return { row, headers, cols };
  }
  return null;
}

/** Data rows under a header, stopping at the first blank cell in `keyCol`. */
function rowsBelow(grid: Grid, headerRow: number, keyCol: number): unknown[][] {
  const out: unknown[][] = [];
  for (const row of grid.slice(headerRow + 1)) {
    const key = row[keyCol];
    if (key == null || String(key).trim() === "") break;
    out.push(row);
  }
  return out;
}

function firstFilled(row: unknown[], from: number): unknown {
  for (let i = from; i < row.length; i++) {
    if (row[i] != null && row[i] !== "") return row[i];
  }
  return null;
}

function sortByDate<T extends { date: IsoDate }>(items: T[]): T[] {
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function rangeOf(dates: IsoDate[]): DateRange | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}
