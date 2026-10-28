"use client";

import { toast } from "sonner";
import { getOriginalUploadUrl } from "./import-actions";

/**
 * Download the original export behind an upload. The server checks access
 * and returns a short-lived signed URL; the original file is kept in Storage
 * for exactly this.
 */
export async function downloadOriginalUpload(uploadId: string, fileName: string) {
  try {
    const res = await getOriginalUploadUrl(uploadId);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const a = document.createElement("a");
    a.href = res.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Download failed.");
  }
}
