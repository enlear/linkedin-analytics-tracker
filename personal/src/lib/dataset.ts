import type {
  DailyEngagement,
  DailyFollowers,
  DateRange,
  DemographicEntry,
  IsoDate,
  ParsedExport,
  PostMetrics,
} from "./linkedin/types";

// The long-running history built from every export the user has imported.
// Exports cover overlapping windows (LinkedIn caps each at 365 days), so
// merging is keyed: daily rows by date, posts by URL. Re-importing the same
// file is a no-op.

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: string;
  period: DateRange | null;
  impressions: number | null;
  membersReached: number | null;
  warnings: string[];
}

export interface Dataset {
  version: 1;
  imports: ImportRecord[];
  daily: DailyEngagement[];
  followerDaily: DailyFollowers[];
  followerTotals: { date: IsoDate; total: number }[];
  posts: PostMetrics[];
  /** Demographics are a snapshot, so only the most recent export's are kept. */
  demographics: { asOf: IsoDate | null; entries: DemographicEntry[] };
}

export function emptyDataset(): Dataset {
  return {
    version: 1,
    imports: [],
    daily: [],
    followerDaily: [],
    followerTotals: [],
    posts: [],
    demographics: { asOf: null, entries: [] },
  };
}

export function isEmpty(ds: Dataset): boolean {
  return ds.imports.length === 0;
}

export function mergeExport(
  ds: Dataset,
  parsed: ParsedExport,
  meta: { id: string; fileName: string; importedAt: string },
): Dataset {
  const periodEnd = parsed.period?.end ?? null;

  const record: ImportRecord = {
    ...meta,
    period: parsed.period,
    impressions: parsed.summary.impressions,
    membersReached: parsed.summary.membersReached,
    warnings: parsed.warnings,
  };
  // The same file imported twice shows up once in the history list.
  const imports = [
    ...ds.imports.filter((i) => !(i.fileName === meta.fileName && samePeriod(i.period, parsed.period))),
    record,
  ];

  const totalDate = parsed.followers.totalAsOf ?? periodEnd;
  const followerTotals =
    parsed.followers.total != null && totalDate
      ? upsertByDate(ds.followerTotals, [{ date: totalDate, total: parsed.followers.total }])
      : ds.followerTotals;

  const newerDemographics =
    parsed.demographics.length > 0 &&
    (ds.demographics.entries.length === 0 || (periodEnd ?? "") >= (ds.demographics.asOf ?? ""));

  return {
    version: 1,
    imports,
    // A later export's numbers for a day replace the earlier ones — LinkedIn
    // keeps attributing late impressions, so newer is more complete.
    daily: upsertByDate(ds.daily, parsed.daily),
    followerDaily: upsertByDate(ds.followerDaily, parsed.followers.daily),
    followerTotals,
    posts: mergePosts(ds.posts, parsed.posts),
    demographics: newerDemographics
      ? { asOf: periodEnd, entries: parsed.demographics }
      : ds.demographics,
  };
}

function upsertByDate<T extends { date: IsoDate }>(existing: T[], incoming: T[]): T[] {
  const byDate = new Map(existing.map((r) => [r.date, r]));
  for (const r of incoming) byDate.set(r.date, r);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Post metrics only grow over time, so the larger value is the more recent
 * one. A post can also appear in only one of the two TOP POSTS tables, so a
 * missing metric is filled from the other export rather than overwritten.
 */
function mergePosts(existing: PostMetrics[], incoming: PostMetrics[]): PostMetrics[] {
  const byUrl = new Map(existing.map((p) => [p.url, p]));
  for (const p of incoming) {
    const prev = byUrl.get(p.url);
    byUrl.set(
      p.url,
      prev
        ? {
            url: p.url,
            publishedOn: prev.publishedOn ?? p.publishedOn,
            impressions: maxOrNull(prev.impressions, p.impressions),
            engagements: maxOrNull(prev.engagements, p.engagements),
          }
        : p,
    );
  }
  return [...byUrl.values()];
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function samePeriod(a: DateRange | null, b: DateRange | null): boolean {
  return a?.start === b?.start && a?.end === b?.end;
}
