import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildExportWorkbook, createDemoExport, workbookToBytes, type BuildOptions } from "@/lib/linkedin/build-export";
import { ExportParseError, parseLinkedInExport } from "@/lib/linkedin/parse-export";
import { SMALL_EXPORT } from "./fixtures/small-export";

const parse = (opts?: BuildOptions) => parseLinkedInExport(workbookToBytes(buildExportWorkbook(SMALL_EXPORT, opts)));

function bytesOf(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return workbookToBytes(wb);
}

function parseError(data: Uint8Array): ExportParseError {
  try {
    parseLinkedInExport(data);
  } catch (e) {
    if (e instanceof ExportParseError) return e;
    throw e;
  }
  throw new Error("expected parseLinkedInExport to throw");
}

describe("parseLinkedInExport — standard export", () => {
  const result = parse();

  it("reads the discovery summary and period", () => {
    expect(result.period).toEqual({ start: "2025-03-01", end: "2025-03-14" });
    expect(result.summary).toEqual({ impressions: 1400, membersReached: 610 });
  });

  it("reads daily impressions and engagements", () => {
    expect(result.daily).toHaveLength(14);
    expect(result.daily[0]).toEqual({ date: "2025-03-01", impressions: 100, engagements: 4 });
  });

  it("reads follower total with its date, and daily gains", () => {
    expect(result.followers.total).toBe(500);
    expect(result.followers.totalAsOf).toBe("2025-03-14");
    expect(result.followers.daily).toHaveLength(14);
  });

  it("merges both TOP POSTS tables by normalised URL", () => {
    const byUrl = Object.fromEntries(result.posts.map((p) => [p.url.split(":").pop(), p]));
    expect(result.posts).toHaveLength(3);
    // 1001 appears in both tables (once with tracking params) → one post, both metrics.
    expect(byUrl["1001"]).toMatchObject({ publishedOn: "2025-03-04", impressions: 900, engagements: 30 });
    expect(byUrl["1002"]).toMatchObject({ impressions: null, engagements: 12 });
    expect(byUrl["1003"]).toMatchObject({ impressions: 300, engagements: null });
  });

  it("reads demographics as 0–1 shares", () => {
    expect(result.demographics).toContainEqual({ category: "Job titles", value: "Engineer", share: 0.2 });
    expect(result.warnings).toEqual([]);
  });
});

describe("parseLinkedInExport — format variations", () => {
  it.each(["dmy", "iso", "excel"] as const)("parses %s dates", (dateStyle) => {
    const r = parse({ dateStyle });
    expect(r.period).toEqual({ start: "2025-03-01", end: "2025-03-14" });
    expect(r.daily[2].date).toBe("2025-03-03");
    expect(r.posts.find((p) => p.url.endsWith("1001"))?.publishedOn).toBe("2025-03-04");
  });

  it("finds sections by content when sheets are renamed", () => {
    const r = parse({
      sheetNames: { discovery: "Sheet1", engagement: "Sheet2", topPosts: "Sheet3", followers: "Sheet4", demographics: "Sheet5" },
    });
    expect(r.daily).toHaveLength(14);
    expect(r.posts).toHaveLength(3);
    expect(r.followers.total).toBe(500);
    expect(r.demographics).toHaveLength(3);
  });

  it("warns, but still parses, when sheets are missing", () => {
    const r = parse({ sheetNames: { followers: null, demographics: null } });
    expect(r.daily).toHaveLength(14);
    expect(r.followers).toEqual({ total: null, totalAsOf: null, daily: [] });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.join(" ")).toMatch(/FOLLOWERS/);
  });

  it("parses percentage text including '< 1%'", () => {
    const r = parse({ sharesAsText: true });
    expect(r.demographics.find((d) => d.value === "Engineer")?.share).toBeCloseTo(0.2);
    expect(r.demographics.find((d) => d.value === "Designer")?.share).toBeCloseTo(0.005);
  });

  it("handles locale-formatted numbers and case/spacing differences in headers", () => {
    const r = parseLinkedInExport(
      bytesOf({
        Engagement: [
          ["  DATE ", "impressions", "Engagements"],
          ["13.03.2025", "1.234", "12"],
          ["14.03.2025", "2 345", "7"],
        ],
      }),
    );
    expect(r.daily).toEqual([
      { date: "2025-03-13", impressions: 1234, engagements: 12 },
      { date: "2025-03-14", impressions: 2345, engagements: 7 },
    ]);
    expect(r.period).toEqual({ start: "2025-03-13", end: "2025-03-14" });
  });

  it("parses the generated demo export", () => {
    const r = parseLinkedInExport(createDemoExport());
    expect(r.daily.length).toBe(90);
    expect(r.posts.length).toBeGreaterThan(5);
    expect(r.warnings).toEqual([]);
  });
});

describe("parseLinkedInExport — errors", () => {
  it("rejects files that are not spreadsheets", () => {
    // Bytes that look like a zip but aren't a valid workbook.
    const err = parseError(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]));
    expect(err.code).toBe("unreadable_file");
  });

  it("rejects an unrelated spreadsheet and names its sheets", () => {
    const err = parseError(bytesOf({ Budget: [["Item", "Cost"], ["Coffee", 3]] }));
    expect(err.code).toBe("not_linkedin_export");
    expect(err.message).toContain('"Budget"');
  });

  it("explains when a single-post export is uploaded instead", () => {
    const err = parseError(
      bytesOf({ Performance: [["Post URL", "https://www.linkedin.com/feed/update/urn:li:activity:1"], ["Post Date", "3/4/2025"], ["Impressions", 10]] }),
    );
    expect(err.code).toBe("single_post_export");
  });

  it("rejects an empty workbook", () => {
    expect(parseError(bytesOf({ Sheet1: [] })).code).toBe("empty_workbook");
  });
});
