"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkImportFile } from "@/lib/company-import/files";
import { cn } from "@/lib/utils";
import {
  PLATFORM_LABELS,
  SUPPORTED_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social-platforms";
import { importCompanyFile } from "./import-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
  // Optional — when set, the dialog opens pre-targeted at this platform.
  initialPlatform?: SocialPlatform;
}

const ALL_PLATFORMS: SocialPlatform[] = ["linkedin", "tiktok", "facebook", "instagram"];

function defaultMonthValue(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const PLATFORM_HINTS: Record<SocialPlatform, string> = {
  linkedin: "Must contain “Metrics” and “All posts” sheets.",
  tiktok: "Must contain an “Overview” sheet with Date, Video Views, Profile Views, Likes, Comments, Shares.",
  facebook: "No file upload — use the “Fetch this month” button on the Facebook tab to pull data via the Meta Graph API.",
  instagram: "No file upload — use the “Fetch this month” button on the Instagram tab. Same Meta connection as Facebook + an Instagram Business Account ID.",
};

// Facebook uses the Graph API fetch flow, not file upload — so when this
// platform is selected the dialog hides the file picker.
function isFileUploadPlatform(p: SocialPlatform): boolean {
  return p === "linkedin" || p === "tiktok";
}

export function CompanyUploadDialog({
  open,
  onOpenChange,
  onUploaded,
  initialPlatform,
}: Props) {
  const [platform, setPlatform] = useState<SocialPlatform>(
    initialPlatform ?? "linkedin",
  );
  const [month, setMonth] = useState(defaultMonthValue());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const supported = SUPPORTED_PLATFORMS.includes(platform);
  const usesFileUpload = isFileUploadPlatform(platform);

  function reset() {
    setFile(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Catch oversized or wrong files on pick: past the server action's body
  // limit the request fails before our own validation can explain why.
  function pickFile(next: File | null) {
    const problem = next ? checkImportFile(next.name, next.size) : null;
    if (problem) {
      toast.error(problem.message);
      reset();
      return;
    }
    setFile(next);
  }

  async function handleSubmit() {
    if (!supported) {
      toast.error(`${PLATFORM_LABELS[platform]} uploads aren't supported yet.`);
      return;
    }
    if (!file) {
      toast.error("Pick an xlsx file first.");
      return;
    }
    if (!month) {
      toast.error("Pick a report month.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("platform", platform);
    form.set("reportMonth", `${month}-01`);
    setBusy(true);
    try {
      // One round trip: the server parses, stores the original and saves.
      const res = await importCompanyFile(form);
      if (!res.ok) throw new Error(res.message);
      toast.success(`Saved ${file.name}.`);
      reset();
      onUploaded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      toast.error(msg);
      reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onOpenChange(v))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload company analytics</DialogTitle>
          <DialogDescription>
            Pick the social platform, the report month, and upload the xlsx
            export. Re-uploading the same month + platform replaces the
            previous data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ----- Platform picker --------------------------------------- */}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_PLATFORMS.map((p) => {
                const enabled = SUPPORTED_PLATFORMS.includes(p);
                const selected = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!enabled || busy}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "rounded-md border text-sm px-3 py-2 transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border hover:bg-muted/40",
                      !enabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {PLATFORM_LABELS[p]}
                    {!enabled ? (
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        Soon
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ----- Month ------------------------------------------------- */}
          <div className="space-y-1.5">
            <Label htmlFor="company-month">Report month</Label>
            <Input
              id="company-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* ----- File (or platform hint for API-fetch platforms) ------- */}
          {!usesFileUpload ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {PLATFORM_HINTS[platform]}
            </div>
          ) : (
          <div className="space-y-1.5">
            <Label htmlFor="company-file">Excel file</Label>
            <label
              htmlFor="company-file"
              className={cn(
                "flex items-center gap-3 border-2 border-dashed rounded-md p-4 transition-colors",
                supported && !busy
                  ? "border-border cursor-pointer hover:border-primary/50 hover:bg-muted/30"
                  : "border-border/50 cursor-not-allowed opacity-60",
              )}
            >
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {file ? file.name : "Choose .xlsx / .xls file (max 4 MB)"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {PLATFORM_HINTS[platform]}
                </div>
              </div>
              <input
                ref={fileRef}
                id="company-file"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                disabled={busy || !supported}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          )}

          {busy ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading, parsing &amp; saving…
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !supported || (usesFileUpload && !file) || !usesFileUpload}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
