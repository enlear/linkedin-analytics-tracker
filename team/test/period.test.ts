import { describe, expect, it } from "vitest";
import { getFilingPeriodForPostDate, toIsoDate } from "@/lib/period";

const filedUnder = (postDate: string) => {
  const p = getFilingPeriodForPostDate(postDate);
  return [toIsoDate(p.reportMonth), toIsoDate(p.start), toIsoDate(p.end)];
};

describe("getFilingPeriodForPostDate", () => {
  it("files posts up to the 19th under that month", () => {
    expect(filedUnder("2026-05-19")).toEqual(["2026-05-01", "2026-04-20", "2026-05-19"]);
  });

  it("rolls posts from the 20th into the next month", () => {
    expect(filedUnder("2026-05-20")).toEqual(["2026-06-01", "2026-05-20", "2026-06-19"]);
  });

  it("rolls late December into January of the next year", () => {
    expect(filedUnder("2026-12-31")).toEqual(["2027-01-01", "2026-12-20", "2027-01-19"]);
  });
});
