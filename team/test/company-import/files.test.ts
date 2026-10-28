import { describe, expect, it } from "vitest";
import { MAX_IMPORT_FILE_BYTES, checkImportFile, importStoragePath } from "@/lib/company-import/files";
import { parseReportMonth } from "@/lib/company-import/shared";

describe("parseReportMonth", () => {
  it("normalises to the first of the month with a label", () => {
    expect(parseReportMonth("2026-05-17")).toEqual({
      reportMonth: "2026-05-01",
      monthKey: "2026-05",
      monthLabel: "May 2026",
      year: 2026,
    });
    expect(parseReportMonth("2026-12")?.monthLabel).toBe("December 2026");
  });

  it("rejects anything not starting YYYY-MM", () => {
    expect(parseReportMonth("May 2026")).toBeNull();
    expect(parseReportMonth("")).toBeNull();
  });
});

describe("checkImportFile", () => {
  it("accepts Excel files up to the limit", () => {
    expect(checkImportFile("May.xlsx", 1024)).toBeNull();
    expect(checkImportFile("OLD.XLS", MAX_IMPORT_FILE_BYTES)).toBeNull();
  });

  it("rejects other types, empty files and files over 4 MB", () => {
    expect(checkImportFile("export.csv", 10)?.code).toBe("invalid_file");
    expect(checkImportFile("export.xlsx", 0)?.code).toBe("empty_file");
    expect(checkImportFile("export.xlsx", MAX_IMPORT_FILE_BYTES + 1)).toEqual({
      code: "file_too_large",
      message: "That file is 4.0 MB; the limit is 4 MB.",
    });
  });
});

describe("importStoragePath", () => {
  const id = "00000000-0000-4000-8000-000000000000";

  it("groups by platform and month, prefixed with a unique id", () => {
    expect(importStoragePath("linkedin", "2026-05", "May export.xlsx", id)).toBe(
      `linkedin/2026-05/${id}-May-export.xlsx`,
    );
  });

  it("reduces names to characters Storage accepts, keeping the extension", () => {
    expect(importStoragePath("tiktok", "2026-04", "Café / Übersicht (1).xlsx", id)).toBe(
      `tiktok/2026-04/${id}-Cafe-Ubersicht-1-.xlsx`,
    );
    const long = importStoragePath("tiktok", "2026-04", `${"a".repeat(300)}.xlsx`, id);
    expect(long.endsWith(".xlsx")).toBe(true);
    expect(long.length).toBeLessThan(160);
    expect(importStoragePath("tiktok", "2026-04", "..", id)).toBe(`tiktok/2026-04/${id}-export`);
  });
});
