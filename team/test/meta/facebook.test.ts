import { describe, expect, it } from "vitest";
import { buildFacebookDailyRows, type FacebookInsight } from "@/lib/meta/facebook";

// end_time is the end of the day being reported, so "2026-05-02T07:00:00+0000"
// carries the numbers for May 1.
function metric(name: string, points: Array<[endTime: string, value: FacebookInsight["values"][number]["value"]]>): FacebookInsight {
  return {
    name,
    period: "day",
    values: points.map(([end_time, value]) => ({ end_time, value })),
  };
}

describe("buildFacebookDailyRows", () => {
  it("maps each Graph metric onto its column, dated the day before end_time", () => {
    const rows = buildFacebookDailyRows(
      [
        metric("page_post_impressions", [["2026-05-02T07:00:00+0000", 100]]),
        metric("page_post_impressions_unique", [["2026-05-02T07:00:00+0000", 80]]),
        metric("page_total_actions", [["2026-05-02T07:00:00+0000", 7]]),
        metric("page_follows", [["2026-05-02T07:00:00+0000", 3]]),
        metric("page_views_total", [["2026-05-02T07:00:00+0000", 42]]),
        metric("page_post_engagements", [["2026-05-02T07:00:00+0000", 12]]),
      ],
      "2026-05-01",
    );

    expect(rows).toEqual([
      {
        date: "2026-05-01",
        impressions: 100,
        reach: 80,
        engaged_users: 7,
        new_followers: 3,
        post_impressions: 42,
        post_engagements: 12,
      },
    ]);
  });

  it("drops the previous month's last day that a since=1st query returns first", () => {
    const rows = buildFacebookDailyRows(
      [
        metric("page_post_impressions", [
          ["2026-05-01T07:00:00+0000", 999],
          ["2026-05-02T07:00:00+0000", 10],
          ["2026-06-01T07:00:00+0000", 20],
          ["2026-06-02T07:00:00+0000", 888],
        ]),
      ],
      "2026-05-01",
    );

    expect(rows.map((r) => [r.date, r.impressions])).toEqual([
      ["2026-05-01", 10],
      ["2026-05-31", 20],
    ]);
  });

  it("sums breakdown objects and leaves missing metrics at zero", () => {
    const [row] = buildFacebookDailyRows(
      [metric("page_post_engagements", [["2026-05-03T07:00:00+0000", { "1": 4, "2": 6 }]])],
      "2026-05-01",
    );

    expect(row).toEqual({
      date: "2026-05-02",
      impressions: 0,
      reach: 0,
      engaged_users: 0,
      new_followers: 0,
      post_impressions: 0,
      post_engagements: 10,
    });
  });

  it("merges metrics by date and returns the days in order", () => {
    const rows = buildFacebookDailyRows(
      [
        metric("page_post_impressions", [
          ["2026-05-04T07:00:00+0000", 30],
          ["2026-05-02T07:00:00+0000", 10],
        ]),
        metric("page_follows", [
          ["2026-05-02T07:00:00+0000", 1],
          ["2026-05-03T07:00:00+0000", 2],
        ]),
      ],
      "2026-05-01",
    );

    expect(rows.map((r) => [r.date, r.impressions, r.new_followers])).toEqual([
      ["2026-05-01", 10, 1],
      ["2026-05-02", 0, 2],
      ["2026-05-03", 30, 0],
    ]);
  });

  it("returns nothing when no point falls in the month", () => {
    expect(
      buildFacebookDailyRows(
        [metric("page_post_impressions", [["2026-05-01T07:00:00+0000", 5]])],
        "2026-05-01",
      ),
    ).toEqual([]);
  });
});
