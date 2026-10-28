import * as XLSX from "xlsx";
import type { DateRange, IsoDate } from "./types";

// Cell-level parsing. LinkedIn writes dates and numbers as text in the
// viewer's locale, Excel may have converted some of them to real dates or
// numbers, and the same export opened and re-saved elsewhere can change
// again — so every helper here accepts all of those shapes.

export type DateOrder = "mdy" | "dmy";

/** Lower-case, trim, collapse whitespace and drop a trailing colon. */
export function normalizeLabel(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim();
}

/**
 * Parse a count or decimal written in any common locale:
 * 1234 · "1,234" · "1.234" · "1 234" · "1'234" · "1,234.5" · "1.234,5".
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).replace(/[\s  ']/g, "");
  if (s === "" || s === "-") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) {
    // "1,234" / "1.234.567" — grouping only. Counts in these exports are
    // integers, so a single 3-digit group is read as thousands, not decimals.
    s = s.replace(/[.,]/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Audience share as 0–1 from 0.05, 5, "5%", "5,2 %" or "< 1%". */
export function parseShare(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? (v > 1 ? v / 100 : v) : null;
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.startsWith("<")) {
    // "< 1%" — LinkedIn's floor for small segments. Use half the bound.
    const bound = parseNumber(s.replace(/[<%]/g, ""));
    return bound == null ? null : bound / 200;
  }
  const n = parseNumber(s.replace("%", ""));
  if (n == null) return null;
  return s.includes("%") || n > 1 ? n / 100 : n;
}

const NUMERIC_DATE = /^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2,4})$/;
const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/;

/**
 * Decide whether "03/04/2025"-style dates in a column are month-first or
 * day-first. Uses, in order: an unambiguous value (a part > 12), the "."
 * separator (day-first locales), then whichever reading makes the column a
 * run of consecutive days. Falls back to LinkedIn's US default.
 */
export function inferDateOrder(values: readonly unknown[]): DateOrder {
  const parts: [number, number, string][] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const m = v.trim().match(NUMERIC_DATE);
    if (m) parts.push([Number(m[1]), Number(m[3]), m[2]]);
  }
  if (parts.some(([a]) => a > 12)) return "dmy";
  if (parts.some(([, b]) => b > 12)) return "mdy";
  if (parts.some(([, , sep]) => sep === ".")) return "dmy";

  const score = (order: DateOrder) => {
    const days = values
      .map((v) => parseDateCell(v, order))
      .filter((d): d is IsoDate => d != null)
      .map((d) => Date.parse(d) / 86_400_000);
    let consecutive = 0;
    for (let i = 1; i < days.length; i++) {
      if (Math.abs(days[i] - days[i - 1]) === 1) consecutive++;
    }
    return consecutive;
  };
  return score("dmy") > score("mdy") ? "dmy" : "mdy";
}

/** Parse one date cell to YYYY-MM-DD, or null if it isn't a date. */
export function parseDateCell(v: unknown, order: DateOrder = "mdy"): IsoDate | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime())
      ? null
      : toIso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === "number") {
    // Excel serial date. The range check keeps plain counts (e.g. 42
    // impressions) from being read as 1900-02-11.
    if (v < 20_000 || v > 80_000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    return d ? toIso(d.y, d.m, d.d) : null;
  }

  const s = String(v ?? "").trim();
  if (!s) return null;

  let m = s.match(ISO_DATE);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(NUMERIC_DATE);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    let year = Number(m[4]);
    if (year < 100) year += 2000;
    return order === "mdy" ? toIso(year, a, b) : toIso(year, b, a);
  }

  // Month names: "Oct 19, 2025", "19 October 2025". Requires a 4-digit year
  // so stray text like "Top 5" never parses.
  if (/[a-z]/i.test(s) && /\b\d{4}\b/.test(s)) {
    const t = Date.parse(`${s} 00:00:00 UTC`);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

/** "10/1/2025 - 10/27/2025" (any dash, any supported date format). */
export function parseDateRange(v: unknown, order?: DateOrder): DateRange | null {
  const pieces = String(v ?? "").split(/\s+[-–—]\s+|\s+to\s+/i);
  if (pieces.length !== 2) return null;
  order ??= inferDateOrder(pieces);
  const start = parseDateCell(pieces[0], order);
  const end = parseDateCell(pieces[1], order);
  return start && end ? { start, end } : null;
}

/**
 * Strip tracking params, fragments and trailing slashes so the same post in
 * two exports compares equal. Path casing is kept — LinkedIn URNs are
 * case-sensitive.
 */
export function normalizePostUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function toIso(y: number, m: number, d: number): IsoDate | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2025-02-31 and month 13 (Date would silently roll them over).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
