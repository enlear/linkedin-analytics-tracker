// Shared queries for monthly post-upload stats. Used by both admin and
// employee dashboards, the employee list, employee detail, and the report.
//
// Reads run as the signed-in user, so row-level security applies: members see
// the whole team's posts (the leaderboard is team-wide) but only their own
// activity. Output shapes are snake_case, matching the tables.

import { fetchPostCategories } from "@/lib/data/post-categories";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { Json, PostUploadRecord } from "@/lib/supabase/database.types";
import { DEFAULT_CATEGORY_WEIGHT, type PostCategory } from "@/lib/post-categories";
import {
  aggregateEmployeeStats,
  buildPeriod,
  rankEmployees,
  splitPostsByCutoff,
  toIsoDate,
  type EmployeeMonthlyStats,
  type TrackingPeriod,
} from "@/lib/period";

export interface PostRow {
  id: string;
  employee_id: string;
  file_name: string;
  post_url: string | null;
  post_date: string;
  post_publish_time: string | null;
  impressions: number;
  reach: number;
  uploaded_at: string;
  validation_status: "accepted" | "rejected";
  rejection_reason: string | null;
  category_id: string | null;
  /** Null when uncategorised (API-synced) or the category was deleted. */
  category_name: string | null;
  /** Live weight of the post's category; DEFAULT_CATEGORY_WEIGHT if none. */
  category_weight: number;
}

export interface PostRowWithReportMonth extends PostRow {
  report_month: string;
}

export interface EmployeeRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

export interface RankedEmployee extends EmployeeMonthlyStats {
  employee: EmployeeRow;
  rank: number;
  /**
   * Posts this employee uploaded AFTER the period's cutoff. They are tracked
   * for progress but excluded from every stat above, so the podium can't move
   * once the month has closed.
   */
  lateCount: number;
}

export interface ActivityRowWithEmployee {
  id: string;
  employee_id: string;
  action: "upload_accepted" | "upload_rejected" | "upload_deleted";
  file_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  employee: { name: string | null; email: string } | null;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

// raw_extracted is left out: it's the parsed file contents, only kept so a
// deleted post takes every trace of its upload with it.
const POST_COLUMNS =
  "id, employee_id, file_name, post_url, post_date, post_publish_time, impressions, reach, validation_status, rejection_reason, category_id, report_month, created_at";

const EMPLOYEE_COLUMNS = "id, email, name, avatar_url, created_at";

type PostRecord = Omit<
  PostUploadRecord,
  "source_sheet_name" | "tracking_period_start" | "tracking_period_end" | "source" | "raw_extracted"
>;

type CategoryIndex = Map<string, PostCategory>;

async function fetchCategoryIndex(): Promise<CategoryIndex> {
  return new Map((await fetchPostCategories()).map((c) => [c.id, c]));
}

function toPostRow(p: PostRecord, categories: CategoryIndex): PostRow {
  const category = p.category_id ? categories.get(p.category_id) : undefined;
  return {
    id: p.id,
    employee_id: p.employee_id,
    file_name: p.file_name,
    post_url: p.post_url,
    post_date: p.post_date,
    post_publish_time: p.post_publish_time,
    impressions: p.impressions,
    reach: p.reach,
    uploaded_at: p.created_at,
    validation_status: p.validation_status,
    rejection_reason: p.rejection_reason,
    category_id: p.category_id,
    category_name: category?.name ?? null,
    category_weight: category?.weight ?? DEFAULT_CATEGORY_WEIGHT,
  };
}

function toPostRowWithMonth(p: PostRecord, categories: CategoryIndex): PostRowWithReportMonth {
  return { ...toPostRow(p, categories), report_month: p.report_month };
}

function asDetails(d: Json | null): Record<string, unknown> | null {
  return d !== null && typeof d === "object" && !Array.isArray(d) ? d : null;
}

// ---------------------------------------------------------------------------
// Public query API
// ---------------------------------------------------------------------------

/** Tally posts per employee — used for the late-upload counts. */
function countByEmployee(posts: Array<{ employee_id: string }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of posts) m.set(p.employee_id, (m.get(p.employee_id) ?? 0) + 1);
  return m;
}

export async function fetchAcceptedPostsForPeriod(period: TrackingPeriod): Promise<PostRow[]> {
  const supabase = await createClient();
  const reportMonth = toIsoDate(period.reportMonth);
  const [rows, categories] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("post_uploads")
        .select(POST_COLUMNS)
        .eq("report_month", reportMonth)
        .eq("validation_status", "accepted")
        .order("post_date", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchCategoryIndex(),
  ]);
  return rows.map((p) => toPostRow(p, categories));
}

/**
 * Every accepted post ever uploaded. One paginated read of the table rather
 * than a query per month — the all-time board needs all of history, and for an
 * internal team this is a page or two.
 */
export async function fetchAllAcceptedPosts(): Promise<PostRowWithReportMonth[]> {
  const supabase = await createClient();
  const [rows, categories] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("post_uploads")
        .select(POST_COLUMNS)
        .eq("validation_status", "accepted")
        .order("id")
        .range(from, to),
    ),
    fetchCategoryIndex(),
  ]);
  return rows.map((p) => toPostRowWithMonth(p, categories));
}

export interface AllTimeStanding extends EmployeeMonthlyStats {
  employee: EmployeeRow;
  /** 1-based; 0 for someone who has never posted. */
  rank: number;
  /**
   * Where they stood a month ago, or null if they had no all-time standing
   * then. Null therefore means genuinely new to the board — not merely that
   * they skipped a month, which is what a month-to-month comparison confused.
   */
  previousRank: number | null;
}

/**
 * All-time standings: every accepted post an employee has ever uploaded,
 * ranked by the same Performance Score, plus how many places they have moved
 * over the last month.
 *
 * Deliberately NOT cutoff-filtered. The monthly winner ignores late uploads so
 * a settled month can't change, but all-time is the progress view — every post
 * an employee has made counts towards it, whenever they got round to filing it.
 *
 * `sinceReportMonthIso` marks the baseline: the board is compared against how
 * it stood BEFORE that report month. Pass the last COMPLETED month, not the one
 * in progress — anchoring on the current month means that on the 1st nothing
 * has been filed yet, the baseline equals the present, and every row correctly
 * but uselessly reports "no change".
 */
export async function fetchAllTimeStandings(
  sinceReportMonthIso: string,
): Promise<AllTimeStanding[]> {
  const [posts, employees] = await Promise.all([fetchAllAcceptedPosts(), fetchAllEmployees()]);

  const rankOf = (rows: PostRowWithReportMonth[]): Map<string, number> => {
    const ranked = rankEmployees(aggregateEmployeeStats(rows)).filter((s) => s.postCount > 0);
    return new Map(ranked.map((s, i) => [s.employeeId, i + 1]));
  };

  const nowRanks = rankOf(posts);
  const priorRanks = rankOf(posts.filter((p) => p.report_month < sinceReportMonthIso));

  const statsById = new Map(aggregateEmployeeStats(posts).map((s) => [s.employeeId, s]));
  const scored = new Map(
    rankEmployees(Array.from(statsById.values())).map((s) => [s.employeeId, s]),
  );

  return employees
    .map((e): AllTimeStanding => {
      const base = scored.get(e.id) ?? {
        employeeId: e.id,
        postCount: 0,
        totalReach: 0,
        totalImpressions: 0,
        avgReach: 0,
        avgImpressions: 0,
        medianReach: 0,
        avgCategoryWeight: 0,
        score: 0,
      };
      return {
        ...base,
        employee: e,
        rank: nowRanks.get(e.id) ?? 0,
        previousRank: priorRanks.get(e.id) ?? null,
      };
    })
    .sort((a, b) => {
      // Never-posted employees fall to the bottom; everyone else by rank.
      if (a.rank === 0 && b.rank === 0) {
        return (a.employee.name ?? a.employee.email).localeCompare(
          b.employee.name ?? b.employee.email,
        );
      }
      if (a.rank === 0) return 1;
      if (b.rank === 0) return -1;
      return a.rank - b.rank;
    });
}

export async function fetchAllEmployees(): Promise<EmployeeRow[]> {
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase.from("employees").select(EMPLOYEE_COLUMNS).order("id").range(from, to),
  );
  return rows.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

export async function fetchLeaderboard(period: TrackingPeriod): Promise<RankedEmployee[]> {
  const [posts, employees] = await Promise.all([
    fetchAcceptedPostsForPeriod(period),
    fetchAllEmployees(),
  ]);

  // Only uploads submitted before the period's cutoff are ranked. Anything
  // later is surfaced as `lateCount` so people still see their progress
  // without the closed month's ranks shifting under them.
  const { counted, late } = splitPostsByCutoff(posts, period);
  const lateById = countByEmployee(late);

  const stats = aggregateEmployeeStats(counted);
  const byId = new Map(stats.map((s) => [s.employeeId, s]));
  const fullStats: EmployeeMonthlyStats[] = employees.map(
    (e) =>
      byId.get(e.id) ?? {
        employeeId: e.id,
        postCount: 0,
        totalReach: 0,
        totalImpressions: 0,
        avgReach: 0,
        avgImpressions: 0,
        medianReach: 0,
        avgCategoryWeight: 0,
        score: 0,
      },
  );

  const ranked = rankEmployees(fullStats);
  const empById = new Map(employees.map((e) => [e.id, e]));
  return ranked.map((s, i) => ({
    ...s,
    rank: s.postCount > 0 ? i + 1 : 0,
    lateCount: lateById.get(s.employeeId) ?? 0,
    employee:
      empById.get(s.employeeId) ??
      ({ id: s.employeeId, email: "(unknown)", name: null, avatar_url: null, created_at: null } as EmployeeRow),
  }));
}

export async function fetchWinnerForReportMonth(
  year: number,
  monthIndex: number,
): Promise<{
  winner: RankedEmployee | null;
  podium: RankedEmployee[];
  period: TrackingPeriod;
}> {
  const period = buildPeriod(year, monthIndex);
  const [posts, employees] = await Promise.all([
    fetchAcceptedPostsForPeriod(period),
    fetchAllEmployees(),
  ]);
  // Same cutoff rule as the leaderboard — a post uploaded after the month
  // closed can never change who won it.
  const { counted, late } = splitPostsByCutoff(posts, period);
  const lateById = countByEmployee(late);
  const stats = aggregateEmployeeStats(counted);
  // rankEmployees orders by Performance Score → medianReach → totalReach. We only
  // surface employees with at least one valid post — uploading is the
  // eligibility bar for the winner / runner-up slots.
  const ranked = rankEmployees(stats).filter((s) => s.postCount > 0);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const unknownEmployee: EmployeeRow = {
    id: "",
    email: "(unknown)",
    name: null,
    avatar_url: null,
    created_at: null,
  };

  const podium: RankedEmployee[] = ranked.slice(0, 3).map((s, i) => ({
    ...s,
    rank: i + 1,
    lateCount: lateById.get(s.employeeId) ?? 0,
    employee: empById.get(s.employeeId) ?? { ...unknownEmployee, id: s.employeeId },
  }));

  return {
    winner: podium[0] ?? null,
    podium,
    period,
  };
}

export async function fetchRecentActivity(limit = 15): Promise<ActivityRowWithEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("upload_activity")
    .select("id, employee_id, action, file_name, details, occurred_at, employee:employees(name, email)")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    action: row.action,
    file_name: row.file_name,
    details: asDetails(row.details),
    created_at: row.occurred_at,
    employee: row.employee ? { name: row.employee.name, email: row.employee.email } : null,
  }));
}

export async function fetchEmployeeById(id: string): Promise<EmployeeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select(EMPLOYEE_COLUMNS).eq("id", id).maybeSingle();
  return data;
}

export async function fetchAllPostsForEmployee(
  employeeId: string,
): Promise<PostRowWithReportMonth[]> {
  const supabase = await createClient();
  const [rows, categories] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("post_uploads")
        .select(POST_COLUMNS)
        .eq("employee_id", employeeId)
        .order("post_date", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchCategoryIndex(),
  ]);
  return rows.map((p) => toPostRowWithMonth(p, categories));
}

export async function fetchPostsForEmployeeInPeriod(
  employeeId: string,
  period: TrackingPeriod,
): Promise<PostRowWithReportMonth[]> {
  const reportMonth = toIsoDate(period.reportMonth);
  const all = await fetchAllPostsForEmployee(employeeId);
  return all.filter((p) => p.report_month === reportMonth);
}
