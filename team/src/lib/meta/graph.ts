// Graph API plumbing shared by the Facebook and Instagram insights fetches.
// Callers pass the Page token from meta_access_token, so this only ever runs
// on the server.

export const GRAPH_VERSION = "v21.0";

export interface InsightValue {
  value: number | Record<string, number>;
  end_time: string;
}

/** The month a fetch covers, in the shapes Graph and the database each want. */
export interface ReportMonth {
  /** "YYYY-MM-01", as stored in company_analytics_uploads.report_month. */
  reportMonth: string;
  /** "May 2026" */
  monthLabel: string;
  /** Unix seconds for the 1st of the month and the 1st of the next, UTC. */
  since: number;
  until: number;
}

/** Accepts "YYYY-MM" or any date in the month; null when it isn't one. */
export function parseReportMonth(value: string): ReportMonth | null {
  const match = String(value).match(/^(\d{4})-(0[1-9]|1[0-2])/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = Date.UTC(year, monthIndex, 1);
  return {
    reportMonth: `${match[1]}-${match[2]}-01`,
    monthLabel: new Date(start).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    since: Math.floor(start / 1000),
    until: Math.floor(Date.UTC(year, monthIndex + 1, 1) / 1000),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Daily-metric end_time is the END of the period — for "day" period that's
// the start of the next day. The metric's date = end_time - 1 day (UTC).
export function dateForEndTime(endTime: string): string {
  const d = new Date(endTime);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function valueAsNumber(v: InsightValue["value"]): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    // Some metrics return { "1": x, "2": y } breakdowns — sum them.
    return Object.values(v).reduce((a, n) => a + (typeof n === "number" ? n : 0), 0);
  }
  return 0;
}

/** Query string for one `/{node}/insights` call; the token is added separately. */
export type InsightsQuery = { metric: string; since: string; until: string } & Record<string, string>;

type InsightsResponse<T> = { ok: true; data: T[] } | { ok: false; message: string };

async function requestInsights<T>(
  nodeId: string,
  query: InsightsQuery,
  accessToken: string,
): Promise<InsightsResponse<T>> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${nodeId}/insights`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url);
    const body = (await res.json()) as { data?: T[]; error?: { message: string } };
    if (body.error) return { ok: false, message: body.error.message };
    return { ok: true, data: body.data ?? [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Runs one request per metric so a single deprecated or invalid metric can't
 * sink the whole fetch: failures are logged and skipped, and only an empty
 * overall result is an error. The requests go out together to stay well
 * inside a serverless function's time limit, and results keep `queries`
 * order so "first error" doesn't depend on which response landed first.
 */
export async function fetchInsights<T>(
  nodeId: string,
  accessToken: string,
  queries: InsightsQuery[],
  logTag: string,
): Promise<T[]> {
  const responses = await Promise.all(
    queries.map((q) => requestInsights<T>(nodeId, q, accessToken)),
  );

  const insights: T[] = [];
  const failures: string[] = [];
  responses.forEach((res, i) => {
    if (res.ok) {
      insights.push(...res.data);
      return;
    }
    const q = queries[i];
    console.warn(`[${logTag}] metric ${q.metric} (${q.since}-${q.until}) failed: ${res.message}`);
    failures.push(`${q.metric}: ${res.message}`);
  });

  if (insights.length === 0) {
    throw new Error(`All metrics failed. First error: ${failures[0] ?? "unknown"}.`);
  }
  return insights;
}
