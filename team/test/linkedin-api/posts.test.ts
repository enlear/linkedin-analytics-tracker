import { describe, expect, it } from "vitest";
import {
  matchPostsToReportMonth,
  parseReportMonth,
  postUrlFromUrn,
  timeFromEpoch,
  toPostUploadRow,
  type RawPost,
} from "@/lib/linkedin-api/posts";
import { normalizePostUrl } from "@/lib/linkedin/parse-export";
import { toIsoDate, type TrackingPeriod } from "@/lib/period";

const at = (iso: string) => Date.parse(iso);

function reportMonth(iso: string): TrackingPeriod {
  const period = parseReportMonth(iso);
  if (!period) throw new Error(`bad report month ${iso}`);
  return period;
}

describe("postUrlFromUrn", () => {
  it.each([
    ["urn:li:share:7123456789012345678"],
    ["urn:li:ugcPost:7123456789012345678"],
  ])("builds the feed URL that de-dups against uploads for %s", (urn) => {
    const url = postUrlFromUrn(urn);
    expect(url).toBe(`https://www.linkedin.com/feed/update/${urn}/`);
    // The xlsx path stores normalizePostUrl(...) of the export's URL; the sync
    // must produce the exact same string or the unique index can't catch it.
    expect(normalizePostUrl(url)).toBe(`https://www.linkedin.com/feed/update/${urn}`);
  });
});

describe("parseReportMonth", () => {
  it("builds the day-20 window for the month", () => {
    const p = reportMonth("2026-05-01");
    expect([toIsoDate(p.reportMonth), toIsoDate(p.start), toIsoDate(p.end)]).toEqual([
      "2026-05-01",
      "2026-04-20",
      "2026-05-19",
    ]);
  });

  it("wraps January's window into the previous year", () => {
    expect(toIsoDate(reportMonth("2027-01-01").start)).toBe("2026-12-20");
  });

  it.each(["May 2026", "2026-13-01", "2026-00-01", ""])("rejects %j", (input) => {
    expect(parseReportMonth(input)).toBeNull();
  });
});

describe("matchPostsToReportMonth", () => {
  const posts: RawPost[] = [
    { id: "urn:li:share:1", publishedAt: at("2026-04-19T23:59:00Z") }, // April
    { id: "urn:li:share:2", publishedAt: at("2026-04-20T00:00:00Z") }, // May
    { id: "urn:li:ugcPost:3", publishedAt: at("2026-05-19T12:00:00Z") }, // May
    { id: "urn:li:share:4", publishedAt: at("2026-05-20T08:00:00Z") }, // June
    { id: "urn:li:share:5", createdAt: at("2026-05-01T09:30:00Z") }, // May, via createdAt
    { id: "urn:li:share:6" }, // no timestamp: can't be filed
  ];

  it("keeps only posts filed under the month by the day-20 rule", () => {
    const matched = matchPostsToReportMonth(posts, reportMonth("2026-05-01"));
    expect(matched.map((m) => m.post.id)).toEqual([
      "urn:li:share:2",
      "urn:li:ugcPost:3",
      "urn:li:share:5",
    ]);
  });

  it("prefers publishedAt over createdAt", () => {
    const [m] = matchPostsToReportMonth(
      [{ id: "urn:li:share:7", publishedAt: at("2026-05-02T00:00:00Z"), createdAt: at("2026-04-01T00:00:00Z") }],
      reportMonth("2026-05-01"),
    );
    expect(m.postDate).toBe("2026-05-02");
  });

  it("files posts from Dec 20 onward under the next year's January", () => {
    const matched = matchPostsToReportMonth(
      [{ id: "urn:li:share:8", publishedAt: at("2026-12-24T10:00:00Z") }],
      reportMonth("2027-01-01"),
    );
    expect(matched).toHaveLength(1);
    expect(toIsoDate(matched[0].period.reportMonth)).toBe("2027-01-01");
  });
});

describe("toPostUploadRow", () => {
  it("maps a synced post to an accepted, uncategorised linkedin_api row", () => {
    const [matched] = matchPostsToReportMonth(
      [{ id: "urn:li:ugcPost:42", publishedAt: at("2026-04-25T14:07:00Z"), commentary: "Hello" }],
      reportMonth("2026-05-01"),
    );

    expect(toPostUploadRow("emp-1", matched, { impressions: 1200, reach: 800 })).toEqual({
      employee_id: "emp-1",
      file_name: "LinkedIn API import",
      source_sheet_name: null,
      post_url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:42",
      post_date: "2026-04-25",
      post_publish_time: "2:07 PM UTC",
      impressions: 1200,
      reach: 800,
      report_month: "2026-05-01",
      tracking_period_start: "2026-04-20",
      tracking_period_end: "2026-05-19",
      validation_status: "accepted",
      rejection_reason: null,
      source: "linkedin_api",
      category_id: null,
      raw_extracted: {
        source: "linkedin_api",
        urn: "urn:li:ugcPost:42",
        commentary: "Hello",
        publishedAt: at("2026-04-25T14:07:00Z"),
        metrics: { IMPRESSION: 1200, MEMBERS_REACHED: 800 },
      },
    });
  });

  it("stores a null commentary when the post has none", () => {
    const [matched] = matchPostsToReportMonth(
      [{ id: "urn:li:share:9", publishedAt: at("2026-05-03T00:00:00Z") }],
      reportMonth("2026-05-01"),
    );
    const row = toPostUploadRow("emp-1", matched, { impressions: 0, reach: 0 });
    expect(row.raw_extracted).toMatchObject({ commentary: null });
  });
});

describe("timeFromEpoch", () => {
  it.each([
    ["2026-05-01T00:00:00Z", "12:00 AM UTC"],
    ["2026-05-01T07:05:00Z", "7:05 AM UTC"],
    ["2026-05-01T12:00:00Z", "12:00 PM UTC"],
    ["2026-05-01T23:59:00Z", "11:59 PM UTC"],
  ])("formats %s as %s", (iso, expected) => {
    expect(timeFromEpoch(at(iso))).toBe(expected);
  });
});
