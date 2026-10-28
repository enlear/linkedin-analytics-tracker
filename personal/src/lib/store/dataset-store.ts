import { del, get, set } from "idb-keyval";
import { emptyDataset, type Dataset } from "@/lib/dataset";

// Persistence is IndexedDB in this browser only. Nothing here talks to a
// network — the page's Content-Security-Policy would block it anyway.

const KEY = "linkedin-analytics:dataset:v1";

export async function loadDataset(): Promise<Dataset> {
  try {
    const stored = await get<Dataset>(KEY);
    return stored?.version === 1 ? stored : emptyDataset();
  } catch {
    // Private windows and blocked storage throw; the app still works for
    // this session, it just won't remember the data.
    return emptyDataset();
  }
}

export async function saveDataset(ds: Dataset): Promise<boolean> {
  try {
    await set(KEY, ds);
    return true;
  } catch {
    return false;
  }
}

export async function clearDataset(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // Nothing stored — nothing to clear.
  }
}
