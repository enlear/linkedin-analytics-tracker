import { describe, expect, it } from "vitest";
import {
  buildInstagramDailyRows,
  chunkRange,
  type InstagramInsight,
} from "@/lib/meta/instagram";
import { parseReportMonth } from "@/lib/meta/graph";

const DAY = 86400;

function daily(name: string, points: Array<[endTime: string, value: number]>): InstagramInsight {
  return { name, period: "day", values: points.map(([end_time, value]) => ({ end_time, value })) };
}

function total(name: string, value: number): InstagramInsight {
  return { name, period: "day", total_value: { value } };
}

describe("buildInstagramDailyRows", () => {
  it("maps the daily series onto their columns, dated the day before end_time", () => {
    const rows = buildInstagramDailyRows(
      [
        daily("reach", [["2026-05-02T07:00:00+0000", 500]]),
        daily("profile_views", [["2026-05-02T07:00:00+0000", 25]]),
        daily("follower_count", [["2026-05-02T07:00:00+0000", 4]]),
      ],
      "2026-05-01",
    );

    expect(rows).toEqual([
      {
        date: "2026-05-01",
        reach: 500,
        views: 0,
        profile_views: 25,
        accounts_engaged: 0,
        total_interactions: 0,
        follower_count: 4,
      },
    ]);
  });

  it("puts period totals on the first day that has data", () => {
    const rows = buildInstagramDailyRows(
      [
        daily("reach", [
          ["2026-05-01T07:00:00+0000", 999],
          ["2026-05-04T07:00:00+0000", 30],
          ["2026-05-03T07:00:00+0000", 20],
        ]),
        total("views", 1200),
        total("accounts_engaged", 90),
        total("total_interactions", 150),
      ],
      "2026-05-01",
    );

    expect(rows.map((r) => [r.date, r.reach, r.views, r.accounts_engaged, r.total_interactions])).toEqual([
      ["2026-05-02", 20, 1200, 90, 150],
      ["2026-05-03", 30, 0, 0, 0],
    ]);
  });

  it("puts period totals on the 1st when there is no daily data", () => {
    expect(buildInstagramDailyRows([total("views", 300)], "2026-02-01")).toEqual([
      {
        date: "2026-02-01",
        reach: 0,
        views: 300,
        profile_views: 0,
        accounts_engaged: 0,
        total_interactions: 0,
        follower_count: 0,
      },
    ]);
  });

  it("adds up the totals from each chunk of a 31-day month", () => {
    const [first] = buildInstagramDailyRows(
      [
        daily("reach", [["2026-05-02T07:00:00+0000", 1]]),
        total("views", 1000),
        total("total_interactions", 40),
        total("views", 70),
        total("total_interactions", 5),
      ],
      "2026-05-01",
    );

    expect(first.views).toBe(1070);
    expect(first.total_interactions).toBe(45);
  });

  it("keeps one row per day when chunks overlap on a boundary day", () => {
    const rows = buildInstagramDailyRows(
      [
        daily("reach", [["2026-05-30T07:00:00+0000", 10]]),
        daily("reach", [["2026-05-30T07:00:00+0000", 10], ["2026-05-31T07:00:00+0000", 11]]),
      ],
      "2026-05-01",
    );

    expect(rows.map((r) => [r.date, r.reach])).toEqual([
      ["2026-05-29", 10],
      ["2026-05-30", 11],
    ]);
  });
});

describe("chunkRange", () => {
  it("splits a 31-day month into 29- and 2-day windows that meet exactly", () => {
    const may = parseReportMonth("2026-05-01")!;
    const chunks = chunkRange(may.since, may.until);

    expect(chunks).toEqual([
      { since: may.since, until: may.since + 29 * DAY },
      { since: may.since + 29 * DAY, until: may.until },
    ]);
  });

  it("keeps February in a single window", () => {
    const feb = parseReportMonth("2026-02")!;
    expect(chunkRange(feb.since, feb.until)).toEqual([{ since: feb.since, until: feb.until }]);
  });
});
