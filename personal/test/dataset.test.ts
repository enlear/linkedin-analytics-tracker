import { describe, expect, it } from "vitest";
import { emptyDataset, mergeExport } from "@/lib/dataset";
import { followerSeries, totals, weekdayPerformance, windows } from "@/lib/insights";
import type { ParsedExport } from "@/lib/linkedin/types";

function parsed(overrides: Partial<ParsedExport>): ParsedExport {
  return {
    period: null,
    summary: { impressions: null, membersReached: null },
    daily: [],
    followers: { total: null, totalAsOf: null, daily: [] },
    posts: [],
    demographics: [],
    warnings: [],
    ...overrides,
  };
}

const meta = (fileName: string) => ({ id: fileName, fileName, importedAt: "2025-04-01T00:00:00Z" });

describe("mergeExport", () => {
  it("dedupes daily rows by date, newer export winning", () => {
    let ds = mergeExport(emptyDataset(), parsed({ daily: [
      { date: "2025-03-01", impressions: 10, engagements: 1 },
      { date: "2025-03-02", impressions: 20, engagements: 2 },
    ] }), meta("a.xlsx"));
    ds = mergeExport(ds, parsed({ daily: [
      { date: "2025-03-02", impressions: 25, engagements: 3 },
      { date: "2025-03-03", impressions: 30, engagements: 3 },
    ] }), meta("b.xlsx"));

    expect(ds.daily.map((d) => [d.date, d.impressions])).toEqual([
      ["2025-03-01", 10],
      ["2025-03-02", 25],
      ["2025-03-03", 30],
    ]);
  });

  it("dedupes posts by URL keeping the highest metrics and filling gaps", () => {
    const url = "https://www.linkedin.com/feed/update/urn:li:activity:1";
    let ds = mergeExport(emptyDataset(), parsed({ posts: [{ url, publishedOn: "2025-03-01", impressions: 100, engagements: null }] }), meta("a"));
    ds = mergeExport(ds, parsed({ posts: [{ url, publishedOn: null, impressions: 150, engagements: 9 }] }), meta("b"));
    expect(ds.posts).toEqual([{ url, publishedOn: "2025-03-01", impressions: 150, engagements: 9 }]);
  });

  it("re-importing the same file keeps one history entry", () => {
    const p = parsed({ period: { start: "2025-03-01", end: "2025-03-31" } });
    let ds = mergeExport(emptyDataset(), p, meta("same.xlsx"));
    ds = mergeExport(ds, p, meta("same.xlsx"));
    expect(ds.imports).toHaveLength(1);
  });

  it("keeps the most recent demographics snapshot", () => {
    const demo = (value: string) => [{ category: "Locations", value, share: 0.1 }];
    let ds = mergeExport(emptyDataset(), parsed({ period: { start: "2025-03-01", end: "2025-03-31" }, demographics: demo("New") }), meta("new"));
    ds = mergeExport(ds, parsed({ period: { start: "2025-01-01", end: "2025-01-31" }, demographics: demo("Old") }), meta("old"));
    expect(ds.demographics.entries[0].value).toBe("New");
  });
});

describe("insights", () => {
  const ds = mergeExport(emptyDataset(), parsed({
    daily: Array.from({ length: 10 }, (_, i) => ({ date: `2025-03-${String(i + 1).padStart(2, "0")}`, impressions: 100, engagements: 5 })),
    followers: {
      total: 110,
      totalAsOf: "2025-03-10",
      daily: Array.from({ length: 10 }, (_, i) => ({ date: `2025-03-${String(i + 1).padStart(2, "0")}`, newFollowers: 1 })),
    },
    posts: [
      { url: "u1", publishedOn: "2025-03-04", impressions: 100, engagements: 10 }, // Tue
      { url: "u2", publishedOn: "2025-03-11", impressions: 300, engagements: 30 }, // Tue
      { url: "u3", publishedOn: "2025-03-06", impressions: 900, engagements: 90 }, // Thu (only one)
    ],
  }), meta("x"));

  it("splits current and previous windows", () => {
    const w = windows(ds, "30d");
    expect(w?.current).toEqual({ start: "2025-03-01", end: "2025-03-10" });
    expect(w?.previous).toBeNull();
  });

  it("totals a window", () => {
    const t = totals(ds, { start: "2025-03-01", end: "2025-03-05" });
    expect(t).toMatchObject({ impressions: 500, engagements: 25, engagementRate: 0.05, newFollowers: 5 });
  });

  it("walks follower counts back from the latest total", () => {
    const s = followerSeries(ds, { start: "2025-03-08", end: "2025-03-10" });
    expect(s.map((p) => p.followers)).toEqual([108, 109, 110]);
  });

  it("only recommends a weekday with at least two posts", () => {
    expect(weekdayPerformance(ds.posts).best?.day).toBe("Tue");
  });
});
