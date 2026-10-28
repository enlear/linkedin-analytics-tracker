import { describe, expect, it } from "vitest";
import { CompanyImportError } from "@/lib/company-import/shared";
import { parseTiktokExport } from "@/lib/company-import/tiktok";
import { TIKTOK_HEADERS, table, tiktokExport, workbookBytes, type Row } from "./fixtures";

function importError(run: () => unknown): CompanyImportError {
  try {
    run();
  } catch (e) {
    if (e instanceof CompanyImportError) return e;
    throw e;
  }
  throw new Error("expected a CompanyImportError");
}

const day = (overrides: Row): Row => ({
  Date: "April 1",
  "Video Views": 10,
  "Profile Views": 1,
  Likes: 2,
  Comments: 0,
  Shares: 0,
  ...overrides,
});

describe("parseTiktokExport", () => {
  it("maps the Overview sheet to snake_case daily rows", () => {
    const rows = parseTiktokExport(tiktokExport(), "2026-04-01");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      date: "2026-04-01",
      video_views: 1200,
      profile_views: 40,
      likes: 95,
      comments: 7,
      shares: 3,
    });
  });

  it("takes the year for 'April 1' dates from the report month", () => {
    const rows = parseTiktokExport(tiktokExport([day({ Date: "april 9" }), day({ Date: "March 31" })]), "2024-04");
    expect(rows.map((r) => r.date)).toEqual(["2024-04-09", "2024-03-31"]);
  });

  it("still reads dated cells and other date formats", () => {
    const rows = parseTiktokExport(
      tiktokExport([day({ Date: "04/02/2026" }), day({ Date: "2026-04-03" }), day({ Date: new Date(2026, 3, 4) })]),
      "2026-04-01",
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-04-02", "2026-04-03", "2026-04-04"]);
  });

  it("skips rows without a readable date", () => {
    const rows = parseTiktokExport(tiktokExport([day({}), day({ Date: null }), day({ Date: "Total" })]), "2026-04-01");
    expect(rows).toHaveLength(1);
  });

  it("rounds counts and treats blanks as 0", () => {
    const [row] = parseTiktokExport(tiktokExport([day({ "Video Views": 12.6, Shares: null, Likes: "8" })]), "2026-04-01");
    expect(row).toMatchObject({ video_views: 13, shares: 0, likes: 8 });
  });

  it("finds the sheet whatever its case", () => {
    expect(parseTiktokExport(tiktokExport(undefined, "overview"), "2026-04-01")).toHaveLength(3);
  });

  it("names the missing sheet and lists the ones found", () => {
    const err = importError(() => parseTiktokExport(tiktokExport(undefined, "Followers"), "2026-04-01"));
    expect(err.code).toBe("missing_sheet");
    expect(err.message).toBe('Sheet "Overview" not found. Found sheets: Followers');
  });

  it("rejects a sheet with no dated rows", () => {
    const err = importError(() =>
      parseTiktokExport(workbookBytes({ Overview: table(TIKTOK_HEADERS, []) }), "2026-04-01"),
    );
    expect(err.code).toBe("empty_file");
    expect(err.message).toBe("No data rows found. Expected an 'Overview' sheet with a Date column.");
  });

  it("rejects a report month it can't read", () => {
    const err = importError(() => parseTiktokExport(tiktokExport(), "April 2026"));
    expect(err.code).toBe("invalid_arg");
  });

  it("reports a corrupt file as parse_failed", () => {
    const truncated = new Uint8Array(tiktokExport()).slice(0, 200).buffer;
    expect(importError(() => parseTiktokExport(truncated, "2026-04-01")).code).toBe("parse_failed");
  });
});
