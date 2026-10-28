// Monthly tracking-period math.
//
// Rules (from product spec):
// - Tracking period for "May 2026" = April 20 → May 19. The report month is
//   the LATER calendar month in that range; a post's report month is decided
//   by the post date (day >= 20 → next month).
// - Uploads are NEVER blocked by date. Users can upload any post, any time;
//   each upload is filed under the report month its postDate falls into.
// - Users are ADVISED to upload by the last day of the report month
//   (`uploadDeadline`). That advice is soft — nothing rejects a late upload.
// - Winner/ranking selection FREEZES at `uploadCutoff` = 00:00 on the 1st of
//   the month after the report month, i.e. the end of the last day. Only posts
//   uploaded strictly before that instant count, so the whole of the last day
//   is usable and the result is settled the moment the 1st begins.
// - Posts uploaded after the cutoff still belong to the month and still show
//   in its stats so people can track progress — they are just not ranked.
// - Winner counts only posts whose postDate falls in that report's
//   [start, end] window.
// - Primary winner metric = the Performance Score (see `scoreEmployees`),
//   a fairness-normalised blend of post quality, consistency, and content
//   value (post-category weight); tie-breakers
//   below. (`avgReach` is still computed for display only.)
// - All "today" calculations use APP_TIMEZONE (defaults to UTC).

import { DEFAULT_CATEGORY_WEIGHT } from "@/lib/post-categories";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "UTC";

export interface TrackingPeriod {
  /** First day of the report month, e.g. 2026-05-01. */
  reportMonth: Date;
  /** 20th of previous month (inclusive). */
  start: Date;
  /** 19th of report month (inclusive). */
  end: Date;
  /**
   * Last day of the report month — the date users are ADVISED to upload by.
   * Nothing is rejected after it; it is the human-facing half of the pair
   * whose machine-facing half is `uploadCutoff`.
   */
  uploadDeadline: Date;
  /**
   * Exclusive instant at which ranking freezes: 00:00 on the 1st of the month
   * AFTER the report month, in APP_TIMEZONE. A post counts toward the winner
   * iff it was uploaded strictly before this. Unlike the other fields here
   * this is a real instant, not a UTC-midnight date-only value.
   */
  uploadCutoff: Date;
  /** Last day of the report month — winner selection day. */
  winnerDate: Date;
  /** "May 2026" */
  label: string;
  /** "April 20 to May 19" */
  rangeLabel: string;
}

/**
 * Today in the configured timezone, returned as a UTC-midnight Date so that
 * downstream date-only math is unambiguous (no DST drift, no off-by-one).
 */
export function getAppToday(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC-midnight Date constructor — keeps date-only values consistent. */
export function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Format a UTC-midnight Date as YYYY-MM-DD (DB-friendly, timezone-agnostic). */
export function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Offset in ms between APP_TIMEZONE wall-clock time and UTC at a given
 * instant (positive east of Greenwich). Derived through Intl so zones that
 * observe DST are handled without a tz database dependency.
 */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  // Some engines render midnight as hour 24 under hour12:false — normalise.
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}

/**
 * The true instant of wall-clock midnight on the given date in APP_TIMEZONE.
 * Two passes so that a DST transition sitting between the first guess and the
 * real answer still resolves correctly.
 */
export function zonedMidnight(year: number, monthIndex: number, day: number): Date {
  const wall = Date.UTC(year, monthIndex, day);
  let ms = wall - tzOffsetMs(new Date(wall), APP_TIMEZONE);
  ms = wall - tzOffsetMs(new Date(ms), APP_TIMEZONE);
  return new Date(ms);
}

/**
 * Return the period whose CALENDAR MONTH contains the given date.
 *
 * Used by `getCurrentTrackingPeriod` to decide which month's dashboard to
 * show — on May 26 we still show "May 2026" even though under the day-20
 * post-filing rule a post dated May 26 would itself be filed under June's
 * report. The two concepts are kept separate on purpose:
 *
 *   - "current month" → calendar month (this function)
 *   - "where this post is filed" → day-20 cutoff (`getFilingPeriodForPostDate`)
 *
 * The dashboard for "May 2026" still uses the day-20 range (April 20 →
 * May 19) when listing posts — `buildPeriod` provides those bounds.
 */
export function getTrackingPeriodForDate(d: Date): TrackingPeriod {
  return buildPeriod(d.getUTCFullYear(), d.getUTCMonth());
}

/**
 * The report period a post is FILED under, by its post date (YYYY-MM-DD):
 * day ≤ 19 → that month's report, day ≥ 20 → next month's. Every ingest path
 * (xlsx upload, LinkedIn API sync) must use this, not the calendar-month
 * `getTrackingPeriodForDate`.
 */
export function getFilingPeriodForPostDate(postDateIso: string): TrackingPeriod {
  const d = new Date(postDateIso + "T00:00:00Z");
  const rollsOver = d.getUTCDate() >= 20;
  // Date.UTC rolls monthIndex 12 into the next January.
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (rollsOver ? 1 : 0), 1));
  return buildPeriod(next.getUTCFullYear(), next.getUTCMonth());
}

/**
 * The tracking period currently being collected for, i.e. the report month
 * today's date falls into under the day-20 boundary rule. On April 19 this
 * is the April report (Mar 20 – Apr 19); on April 20 it flips to the May
 * report (Apr 20 – May 19).
 */
export function getCurrentTrackingPeriod(): TrackingPeriod {
  return getTrackingPeriodForDate(getAppToday());
}

/** The report month immediately before the given period. */
export function getPeriodBefore(period: TrackingPeriod): TrackingPeriod {
  const m = period.reportMonth.getUTCMonth() - 1;
  const y = m < 0 ? period.reportMonth.getUTCFullYear() - 1 : period.reportMonth.getUTCFullYear();
  return buildPeriod(y, (m + 12) % 12);
}

/** The previous report month's tracking period, relative to today. */
export function getPreviousTrackingPeriod(): TrackingPeriod {
  return getPeriodBefore(getCurrentTrackingPeriod());
}

/**
 * Build the period descriptor for a specific report month.
 *
 * Tracking-period ranges use the day-20 boundary: May 2026's range is
 * April 20 → May 19. Posts dated within that window are filed under May's
 * report (see `getTrackingPeriodForDate`). Winner selection happens on the
 * last day of the report's calendar month.
 *
 * Note: this is intentionally different from `getCurrentTrackingPeriod` —
 * "current month" tracks the calendar month, but the period RANGE for that
 * month still spans previous-20 → this-19 to match how posts are filed.
 */
export function buildPeriod(year: number, monthIndex: number): TrackingPeriod {
  const reportMonth = utcDate(year, monthIndex, 1);
  const startMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const startYear = monthIndex === 0 ? year - 1 : year;
  const start = utcDate(startYear, startMonthIndex, 20);
  const end = utcDate(year, monthIndex, 19);

  // Last day of the report's calendar month — for displayed deadline + winner.
  const lastDayOfMonth = utcDate(year, monthIndex + 1, 0);
  const winnerDate = lastDayOfMonth;
  const uploadDeadline = lastDayOfMonth;

  // Ranking freezes at the END of the last day — expressed as 00:00 on the 1st
  // of the next month so the boundary is exact and exclusive (no 23:59:59
  // fudge, no gap). Date.UTC rolls monthIndex 12 into the next January.
  const uploadCutoff = zonedMidnight(year, monthIndex + 1, 1);

  const label = reportMonth.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const rangeLabel = `${formatMonthDay(start)} to ${formatMonthDay(end)}`;

  return {
    reportMonth,
    start,
    end,
    uploadDeadline,
    uploadCutoff,
    winnerDate,
    label,
    rangeLabel,
  };
}

function formatMonthDay(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric" });
}

/** Is the given post date within the period's [start, end] inclusive range? */
export function isPostDateInPeriod(postDate: Date, period: TrackingPeriod): boolean {
  const t = postDate.getTime();
  return t >= period.start.getTime() && t <= period.end.getTime();
}

/**
 * Whether the upload window for a period is closed.
 *
 * Uploads are no longer date-gated — kept as a stable export so callers
 * (dashboard / upload page) don't need to branch on a removed function. Always
 * returns false; each upload is filed under whichever report month its
 * postDate lands in, regardless of when the user uploads.
 */
export function isUploadWindowClosed(_period: TrackingPeriod, _today = getAppToday()): boolean {
  return false;
}

/**
 * Has this period's ranking frozen? False while the month is still open (the
 * leaderboard moves live), true from `uploadCutoff` onward — from which point
 * ranks and the winner are fixed and later uploads are tracked but not ranked.
 */
export function isPeriodLocked(period: TrackingPeriod, now: Date = new Date()): boolean {
  return now.getTime() >= period.uploadCutoff.getTime();
}

/**
 * Was this upload submitted too late to count toward the period's winner?
 * `uploadedAt` is the row's creation timestamp (`PostRow.uploaded_at`).
 */
export function isLateUpload(uploadedAt: string | Date, period: TrackingPeriod): boolean {
  const t = typeof uploadedAt === "string" ? Date.parse(uploadedAt) : uploadedAt.getTime();
  // An unparseable timestamp counts rather than being silently dropped —
  // losing a real post is worse than admitting one of unknown age.
  if (Number.isNaN(t)) return false;
  return t >= period.uploadCutoff.getTime();
}

/**
 * Split a period's posts into the ones that count toward the winner and the
 * ones that arrived after the cutoff (kept for progress tracking only).
 */
export function splitPostsByCutoff<T extends { uploaded_at: string }>(
  posts: T[],
  period: TrackingPeriod,
): { counted: T[]; late: T[] } {
  const counted: T[] = [];
  const late: T[] = [];
  for (const p of posts) {
    if (isLateUpload(p.uploaded_at, period)) late.push(p);
    else counted.push(p);
  }
  return { counted, late };
}

// ---------------------------------------------------------------------------
// Ranking / winner selection
// ---------------------------------------------------------------------------

export interface EmployeeMonthlyStats {
  employeeId: string;
  postCount: number;
  totalReach: number;
  totalImpressions: number;
  avgReach: number;
  avgImpressions: number;
  /** Median reach across the employee's posts — the "quality" input to the score. */
  medianReach: number;
  /**
   * Mean post-category weight across the employee's posts — the "content"
   * input to the score. Uncategorised posts count as DEFAULT_CATEGORY_WEIGHT.
   */
  avgCategoryWeight: number;
  /**
   * Performance Score: 0–1 blend of normalised quality, consistency and content, computed
   * relative to the month's participants. Populated by `scoreEmployees` /
   * `rankEmployees`; 0 for employees with no valid posts. See `scoreEmployees`.
   */
  score: number;
}

/**
 * Weights for the Performance Score (sum to 1). Quality is favoured over raw
 * volume; content rewards the more valuable post types (articles over
 * direct posts over event updates — see post categories).
 *
 * Quality : consistency is kept at 70 : 30. In a month where no post has a
 * category, content is the same for everyone, so quality and consistency
 * alone decide the ranking.
 */
export const QUALITY_WEIGHT = 0.56;
export const CONSISTENCY_WEIGHT = 0.24;
export const CONTENT_WEIGHT = 0.2;


/** Median of a list of numbers (0 for an empty list). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Aggregate raw post rows into per-employee monthly stats. Only ACCEPTED posts
 * within the period contribute. (Caller filters before calling.)
 *
 * Note: `score` is left at 0 here — it depends on the whole participant pool,
 * so it's filled in later by `scoreEmployees` / `rankEmployees`.
 */
export function aggregateEmployeeStats(
  rows: Array<{
    employee_id: string;
    reach: number;
    impressions: number;
    category_weight?: number;
  }>,
): EmployeeMonthlyStats[] {
  const m = new Map<string, EmployeeMonthlyStats>();
  const reaches = new Map<string, number[]>();
  const weightSums = new Map<string, number>();
  for (const r of rows) {
    const cur =
      m.get(r.employee_id) ??
      ({
        employeeId: r.employee_id,
        postCount: 0,
        totalReach: 0,
        totalImpressions: 0,
        avgReach: 0,
        avgImpressions: 0,
        medianReach: 0,
        avgCategoryWeight: 0,
        score: 0,
      } as EmployeeMonthlyStats);
    cur.postCount += 1;
    cur.totalReach += r.reach;
    cur.totalImpressions += r.impressions;
    m.set(r.employee_id, cur);

    const arr = reaches.get(r.employee_id) ?? [];
    arr.push(r.reach);
    reaches.set(r.employee_id, arr);

    weightSums.set(
      r.employee_id,
      (weightSums.get(r.employee_id) ?? 0) + (r.category_weight ?? DEFAULT_CATEGORY_WEIGHT),
    );
  }
  for (const s of m.values()) {
    s.avgReach = s.postCount > 0 ? s.totalReach / s.postCount : 0;
    s.avgImpressions = s.postCount > 0 ? s.totalImpressions / s.postCount : 0;
    s.medianReach = median(reaches.get(s.employeeId) ?? []);
    s.avgCategoryWeight = s.postCount > 0 ? (weightSums.get(s.employeeId) ?? 0) / s.postCount : 0;
  }
  return Array.from(m.values());
}

/**
 * Compute the Performance Score for each employee.
 *
 * Plain "average reach" is unfair: a single lucky viral post beats sustained
 * output, outliers dominate the mean, and raw reach mostly tracks audience
 * size rather than content quality. The Performance Score fixes this by scoring
 * each employee RELATIVE TO THE MONTH'S FIELD on three normalised dimensions:
 *
 *   1. Quality     = MEDIAN reach per post (median, not mean, so one viral
 *                    post can't distort a typical performance).
 *   2. Consistency = number of valid posts (rewards showing up regularly).
 *   3. Content     = MEAN post-category weight (rewards the more valuable
 *                    post types, e.g. an article over an event update).
 *
 * Quality and consistency use small-team min–max scaling: within the month's
 * participants, the best gets 1.0, the worst 0.0, everyone else in between:
 *
 *       scaled = (value − min) / (max − min)        (→ 1.0 if everyone is tied)
 *
 * Content is scaled as a ratio to the field's best instead (value / max).
 * Category weights sit close together (e.g. 1.0–2.0), and min–max would turn
 * a small gap in post mix into a full 0-vs-1 swing; the ratio keeps an
 * all-"Other" month at a proportionate share of the content points.
 *
 * The final score blends them by weight:
 *
 *       score = QUALITY_WEIGHT × qualityScaled
 *             + CONSISTENCY_WEIGHT × consistencyScaled
 *             + CONTENT_WEIGHT × contentScaled
 *
 * All inputs live on the same 0–1 scale, so the weighted sum is meaningful and
 * lands in [0, 1]. Employees with no valid posts score 0 and are excluded from
 * winner selection.
 */
export function scoreEmployees(stats: EmployeeMonthlyStats[]): EmployeeMonthlyStats[] {
  const participants = stats.filter((s) => s.postCount > 0);
  if (participants.length === 0) return stats.map((s) => ({ ...s, score: 0 }));

  const medians = participants.map((s) => s.medianReach);
  const counts = participants.map((s) => s.postCount);
  const minMed = Math.min(...medians);
  const maxMed = Math.max(...medians);
  const minCnt = Math.min(...counts);
  const maxCnt = Math.max(...counts);
  const maxContent = Math.max(...participants.map((s) => s.avgCategoryWeight));

  // Min–max scale; when the whole field is tied on a dimension (max === min),
  // everyone is equally "best" on it → 1.0, so it contributes a constant.
  const scale = (v: number, lo: number, hi: number) => (hi === lo ? 1 : (v - lo) / (hi - lo));

  return stats.map((s) => {
    if (s.postCount === 0) return { ...s, score: 0 };
    const quality = scale(s.medianReach, minMed, maxMed);
    const consistency = scale(s.postCount, minCnt, maxCnt);
    const content = maxContent > 0 ? s.avgCategoryWeight / maxContent : 1;
    return {
      ...s,
      score:
        QUALITY_WEIGHT * quality + CONSISTENCY_WEIGHT * consistency + CONTENT_WEIGHT * content,
    };
  });
}

/**
 * Rank employees by Performance Score desc → median reach desc → total reach
 * desc. Employees with zero valid posts are kept at the bottom but are excluded
 * from winner selection. Scores are (re)computed here via `scoreEmployees`.
 */
export function rankEmployees(stats: EmployeeMonthlyStats[]): EmployeeMonthlyStats[] {
  return scoreEmployees(stats).sort((a, b) => {
    if (a.postCount === 0 && b.postCount === 0) return 0;
    if (a.postCount === 0) return 1;
    if (b.postCount === 0) return -1;
    if (b.score !== a.score) return b.score - a.score;
    if (b.medianReach !== a.medianReach) return b.medianReach - a.medianReach;
    return b.totalReach - a.totalReach;
  });
}

/** Top-ranked employee with at least one valid post; null otherwise. */
export function selectWinner(stats: EmployeeMonthlyStats[]): EmployeeMonthlyStats | null {
  const ranked = rankEmployees(stats);
  return ranked.find((s) => s.postCount > 0) ?? null;
}
