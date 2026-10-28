import { describe, expect, it } from "vitest";
import { parseLinkedInCompanyExport } from "@/lib/company-import/linkedin";
import { CompanyImportError } from "@/lib/company-import/shared";
import {
  MAY_METRICS,
  METRICS_HEADERS,
  POST_HEADERS,
  linkedinCompanyExport,
  titledTable,
  workbookBytes,
  type Row,
} from "./fixtures";

function importError(run: () => unknown): CompanyImportError {
  try {
    run();
  } catch (e) {
    if (e instanceof CompanyImportError) return e;
    throw e;
  }
  throw new Error("expected a CompanyImportError");
}

const day = (overrides: Row): Row => ({ ...MAY_METRICS[0], ...overrides });

describe("parseLinkedInCompanyExport — Metrics sheet", () => {
  const { daily } = parseLinkedInCompanyExport(linkedinCompanyExport());

  it("reads one row per day, headers taken from below the title row", () => {
    expect(daily.map((d) => d.date)).toEqual(["2026-05-01", "2026-05-02"]);
  });

  it("maps every column, with organic/sponsored breakdowns, to snake_case", () => {
    expect(daily[0]).toEqual({
      date: "2026-05-01",
      impressions: 150,
      impressions_organic: 120,
      impressions_sponsored: 30,
      unique_impressions: 90,
      clicks: 8,
      clicks_organic: 6,
      clicks_sponsored: 2,
      reactions: 11,
      reactions_organic: 10,
      reactions_sponsored: 1,
      comments: 2,
      comments_organic: 2,
      comments_sponsored: 0,
      reposts: 1,
      reposts_organic: 1,
      reposts_sponsored: 0,
      engagement_rate: 0.147,
      engagement_rate_organic: 0.158,
      engagement_rate_sponsored: 0.1,
    });
  });

  it("sums organic + sponsored when the total column is missing or zero", () => {
    const headers = METRICS_HEADERS.filter((h) => !h.endsWith("(total)"));
    const [row] = parseLinkedInCompanyExport(
      linkedinCompanyExport({ metricsHeaders: headers, metrics: [day({})] }),
    ).daily;
    expect(row).toMatchObject({ impressions: 150, clicks: 8, reactions: 11, comments: 2, reposts: 1 });
    // No total engagement rate either: falls back to the organic one.
    expect(row.engagement_rate).toBe(0.158);

    const [zeroTotal] = parseLinkedInCompanyExport(
      linkedinCompanyExport({ metrics: [day({ "Impressions (total)": 0 })] }),
    ).daily;
    expect(zeroTotal.impressions).toBe(150);
  });

  it("rounds counts, reads numeric text and treats blanks as 0", () => {
    const [row] = parseLinkedInCompanyExport(
      linkedinCompanyExport({
        metrics: [day({ "Impressions (organic)": 120.6, "Clicks (organic)": "7", "Comments (organic)": null })],
      }),
    ).daily;
    expect(row).toMatchObject({ impressions_organic: 121, clicks_organic: 7, comments_organic: 0 });
  });

  it("accepts m/d/yy, ISO, Excel serial and date-typed cells", () => {
    const dates = parseLinkedInCompanyExport(
      linkedinCompanyExport({
        metrics: [
          day({ Date: "5/3/26" }),
          day({ Date: "2026-05-04" }),
          day({ Date: 46147 }),
          day({ Date: new Date(2026, 4, 6) }),
        ],
      }),
    ).daily.map((d) => d.date);
    expect(dates).toEqual(["2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06"]);
  });

  it("skips rows without a readable date", () => {
    const { daily: rows } = parseLinkedInCompanyExport(
      linkedinCompanyExport({ metrics: [day({}), day({ Date: null }), day({ Date: "Total" })] }),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("parseLinkedInCompanyExport — All posts sheet", () => {
  const { posts } = parseLinkedInCompanyExport(linkedinCompanyExport());

  it("maps a post row to snake_case, trimming text", () => {
    expect(posts[0]).toEqual({
      post_title: "Launch day at Example Co",
      post_link: "https://www.linkedin.com/feed/update/urn:li:activity:2001",
      post_type: "Organic",
      posted_by: "Example Admin",
      created_date: "2026-05-04",
      content_type: "Image",
      impressions: 900,
      views: 0,
      offsite_views: 0,
      clicks: 40,
      click_through_rate: 0.0444,
      likes: 25,
      comments: 3,
      reposts: 2,
      follows: 1,
      engagement_rate: 0.0778,
    });
  });

  it("keeps posts with only a link, and nulls missing text", () => {
    expect(posts[1]).toMatchObject({ post_title: null, posted_by: null, impressions: 300, views: 120 });
  });

  it("skips rows with neither title nor link", () => {
    const blank: Row = { Impressions: 5 };
    const { posts: rows } = parseLinkedInCompanyExport(
      workbookBytes({
        Metrics: titledTable("Metrics", METRICS_HEADERS, []),
        "All posts": titledTable("All posts", POST_HEADERS, [{ "Post title": "Only one" }, blank]),
      }),
    );
    expect(rows.map((p) => p.post_title)).toEqual(["Only one"]);
  });
});

describe("parseLinkedInCompanyExport — errors", () => {
  it("names the missing sheet and lists the ones found", () => {
    const err = importError(() =>
      parseLinkedInCompanyExport(workbookBytes({ "All posts": titledTable("All posts", POST_HEADERS, []) })),
    );
    expect(err.code).toBe("missing_sheet");
    expect(err.message).toBe('Sheet "Metrics" not found. Found sheets: All posts');

    const noPosts = importError(() =>
      parseLinkedInCompanyExport(workbookBytes({ Metrics: titledTable("Metrics", METRICS_HEADERS, MAY_METRICS) })),
    );
    expect(noPosts.message).toBe('Sheet "All posts" not found. Found sheets: Metrics');
  });

  it("matches sheet names exactly", () => {
    const err = importError(() =>
      parseLinkedInCompanyExport(
        workbookBytes({
          metrics: titledTable("Metrics", METRICS_HEADERS, MAY_METRICS),
          "All posts": titledTable("All posts", POST_HEADERS, []),
        }),
      ),
    );
    expect(err.code).toBe("missing_sheet");
  });

  it("rejects a workbook with no data rows", () => {
    const err = importError(() => parseLinkedInCompanyExport(linkedinCompanyExport({ metrics: [], posts: [] })));
    expect(err.code).toBe("empty_file");
    expect(err.message).toBe(
      "No data rows found in either sheet. Make sure the xlsx has 'Metrics' and 'All posts' tabs.",
    );
  });

  it("reports a corrupt file as parse_failed", () => {
    const truncated = new Uint8Array(linkedinCompanyExport()).slice(0, 200).buffer;
    expect(importError(() => parseLinkedInCompanyExport(truncated)).code).toBe("parse_failed");
  });

  it("treats a non-spreadsheet as a workbook without the expected sheets", () => {
    const text = new TextEncoder().encode("not,a,spreadsheet").buffer as ArrayBuffer;
    expect(importError(() => parseLinkedInCompanyExport(text)).code).toBe("missing_sheet");
  });
});
