"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { emptyDataset, mergeExport, type Dataset } from "@/lib/dataset";
import { clearDataset, loadDataset, saveDataset } from "@/lib/store/dataset-store";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

// SheetJS is most of the bundle; load it only when a file is actually read.
const loadParser = () => import("@/lib/linkedin/parse-export");

/** App state: the merged dataset plus the actions that change it. */
export function useAnalytics() {
  const [dataset, setDataset] = useState<Dataset>(emptyDataset);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDataset().then((ds) => {
      setDataset(ds);
      setLoading(false);
    });
  }, []);

  const commit = useCallback(async (next: Dataset) => {
    setDataset(next);
    if (!(await saveDataset(next))) {
      toast.warning("Your browser blocked local storage, so this data will be gone when you close the tab.");
    }
  }, []);

  const importFiles = useCallback(
    async (files: File[]) => {
      const { ExportParseError, parseLinkedInExport } = await loadParser();
      let next = dataset;
      let imported = 0;
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: file is too large to be a LinkedIn export.`);
          continue;
        }
        try {
          const parsed = parseLinkedInExport(await file.arrayBuffer());
          next = mergeExport(next, parsed, {
            id: crypto.randomUUID(),
            fileName: file.name,
            importedAt: new Date().toISOString(),
          });
          imported++;
          for (const w of parsed.warnings) toast.message(`${file.name}: ${w}`);
        } catch (e) {
          const message = e instanceof ExportParseError ? e.message : "Unexpected error while reading the file.";
          toast.error(`${file.name}: ${message}`);
        }
      }
      if (imported > 0) {
        await commit(next);
        toast.success(imported === 1 ? "Export imported." : `${imported} exports imported.`);
      }
    },
    [dataset, commit],
  );

  const loadDemo = useCallback(async () => {
    const [{ parseLinkedInExport }, { createDemoExport }] = await Promise.all([
      loadParser(),
      import("@/lib/linkedin/build-export"),
    ]);
    const parsed = parseLinkedInExport(createDemoExport());
    await commit(
      mergeExport(emptyDataset(), parsed, {
        id: "demo",
        fileName: "demo-data.xlsx",
        importedAt: new Date().toISOString(),
      }),
    );
  }, [commit]);

  const clear = useCallback(async () => {
    await clearDataset();
    setDataset(emptyDataset());
  }, []);

  /** Downloads the merged history as JSON — a backup the user controls. */
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkedin-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dataset]);

  return { dataset, loading, importFiles, loadDemo, clear, exportJson };
}
