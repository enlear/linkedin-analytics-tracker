import { describe, expect, it } from "vitest";
import { parseReportMonth } from "@/lib/meta/graph";

describe("parseReportMonth", () => {
  it("normalises any date in the month and builds the UTC window and label", () => {
    expect(parseReportMonth("2026-05-17")).toEqual({
      reportMonth: "2026-05-01",
      monthLabel: "May 2026",
      since: Date.UTC(2026, 4, 1) / 1000,
      until: Date.UTC(2026, 5, 1) / 1000,
    });
  });

  it("rejects values that aren't a month", () => {
    expect(parseReportMonth("May 2026")).toBeNull();
    expect(parseReportMonth("2026-13-01")).toBeNull();
  });
});
