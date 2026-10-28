// Rules for company export files, shared by the upload dialog and the import
// server action. Kept free of xlsx so the dialog doesn't bundle it.

/**
 * The file travels in the server action's request body. Vercel caps function
 * bodies at 4.5 MB and next.config sets the action limit to 4 MiB, so check
 * up front rather than let the request fail with a generic error. The cap sits
 * below that limit to leave room for the multipart framing around the file.
 */
export const MAX_IMPORT_FILE_BYTES = 4_000_000;

const EXTENSIONS = [".xlsx", ".xls"];

export interface ImportFileProblem {
  code: "invalid_file" | "empty_file" | "file_too_large";
  message: string;
}

export function checkImportFile(name: string, size: number): ImportFileProblem | null {
  const lower = name.toLowerCase();
  if (!EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { code: "invalid_file", message: "Upload an Excel file (.xlsx or .xls)." };
  }
  if (size === 0) return { code: "empty_file", message: "That file is empty." };
  if (size > MAX_IMPORT_FILE_BYTES) {
    return {
      code: "file_too_large",
      message: `That file is ${(size / 1_000_000).toFixed(1)} MB; the limit is 4 MB.`,
    };
  }
  return null;
}

/**
 * Where the original file is kept in the `company-uploads` bucket. The random
 * id keeps a re-import from overwriting the file it is replacing until the
 * database has switched over. Storage keys reject many characters (accents
 * included), so the name is reduced to a safe ASCII form.
 */
export function importStoragePath(platform: string, monthKey: string, fileName: string, id: string): string {
  const safe =
    fileName
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      // Keep the end, so the extension survives.
      .slice(-100) || "export";
  return `${platform}/${monthKey}/${id}-${safe}`;
}
