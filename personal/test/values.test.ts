import { describe, expect, it } from "vitest";
import {
  inferDateOrder,
  normalizePostUrl,
  parseDateCell,
  parseDateRange,
  parseNumber,
  parseShare,
} from "@/lib/linkedin/values";

describe("parseNumber", () => {
  it.each([
    [1234, 1234],
    ["1,234", 1234],
    ["1.234", 1234],
    ["1 234", 1234],
    ["1 234", 1234],
    ["1'234", 1234],
    ["1,234.5", 1234.5],
    ["1.234,5", 1234.5],
    ["0.05", 0.05],
    ["12", 12],
  ])("%j → %j", (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([null, "", "-", "n/a"])("%j → null", (input) => {
    expect(parseNumber(input)).toBeNull();
  });
});

describe("parseShare", () => {
  it.each([
    [0.05, 0.05],
    [5, 0.05],
    ["5%", 0.05],
    ["5,5 %", 0.055],
    ["< 1%", 0.005],
  ])("%j → %j", (input, expected) => {
    expect(parseShare(input)).toBeCloseTo(expected);
  });
});

describe("dates", () => {
  it("parses US, European, ISO, month-name and Excel serial dates", () => {
    expect(parseDateCell("3/14/2025", "mdy")).toBe("2025-03-14");
    expect(parseDateCell("14/3/2025", "dmy")).toBe("2025-03-14");
    expect(parseDateCell("2025-03-14")).toBe("2025-03-14");
    expect(parseDateCell("Mar 14, 2025")).toBe("2025-03-14");
    expect(parseDateCell(45730)).toBe("2025-03-14");
  });

  it("rejects impossible dates and small numbers", () => {
    expect(parseDateCell("2/30/2025", "mdy")).toBeNull();
    expect(parseDateCell(42)).toBeNull();
    expect(parseDateCell("Top 5")).toBeNull();
  });

  it("infers day-first when a day exceeds 12 or dots are used", () => {
    expect(inferDateOrder(["1/3/2025", "25/3/2025"])).toBe("dmy");
    expect(inferDateOrder(["3/25/2025"])).toBe("mdy");
    expect(inferDateOrder(["01.03.2025"])).toBe("dmy");
  });

  it("infers order from consecutive days when every value is ambiguous", () => {
    // 1–5 March written day-first: only the dmy reading is a run of days.
    expect(inferDateOrder(["1/3/2025", "2/3/2025", "3/3/2025", "4/3/2025"])).toBe("dmy");
    expect(inferDateOrder(["3/1/2025", "3/2/2025", "3/3/2025", "3/4/2025"])).toBe("mdy");
  });

  it("parses a date range", () => {
    expect(parseDateRange("3/1/2025 - 3/14/2025")).toEqual({ start: "2025-03-01", end: "2025-03-14" });
    expect(parseDateRange("not a range")).toBeNull();
  });
});

describe("normalizePostUrl", () => {
  it("drops query, hash and trailing slash but keeps case", () => {
    expect(normalizePostUrl(" https://www.linkedin.com/feed/update/urn:li:activity:ABC/?utm=x#c ")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:activity:ABC",
    );
  });
});
