"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatNumber } from "@/lib/utils";
import type { PostCategory } from "@/lib/post-categories";
import { ingestPostUpload, type UploadOutcome } from "./actions";

type Status = "idle" | "uploading" | "done" | "error";

interface UploadFormProps {
  periodLabel: string;
  rangeLabel: string;
  periodStartIso: string;
  periodEndIso: string;
  /** Active categories only, heaviest first. */
  categories: PostCategory[];
}

export function UploadForm({ rangeLabel, categories }: UploadFormProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<UploadOutcome | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!categoryId) {
      toast.error("Choose a post type before uploading.");
      return;
    }
    setFileName(file.name);
    setOutcome(null);
    setProgress(5);
    setStatus("uploading");

    try {
      // The server parses the file in memory and keeps only the numbers.
      const body = new FormData();
      body.set("file", file);
      body.set("categoryId", categoryId);
      setProgress(40);
      const result = await ingestPostUpload(body);

      setOutcome(result);
      setProgress(100);
      setStatus(result.ok ? "done" : "error");

      if (result.ok) {
        // Each post gets its own deliberate choice — don't carry it over.
        setCategoryId(null);
        toast.success("Post analytics saved.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      setOutcome({ ok: false, code: "invalid_file", message: msg });
      toast.error(msg);
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) void handleFile(file);
  };

  const busy = status === "uploading";
  const locked = busy || !categoryId;

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Uploads are paused until an admin sets up post categories. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3" disabled={busy}>
        <legend className="text-sm font-medium">
          1. What type of post is this? <span className="text-destructive">*</span>
        </legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name="post-category"
                  value={c.id}
                  checked={selected}
                  onChange={() => setCategoryId(c.id)}
                  className="mt-0.5 accent-primary"
                />
                <span className="min-w-0">
                  <span className="font-medium block">{c.name}</span>
                  {c.description ? (
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {c.description}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="text-sm font-medium">2. Upload the analytics export</div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        aria-disabled={locked}
        className={cn(
          "block border-2 border-dashed border-border rounded-lg p-12 text-center transition-colors",
          locked
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
          disabled={locked}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="font-medium">Drop a LinkedIn post analytics .xlsx here</div>
            <div className="text-sm text-muted-foreground mt-1">
              {categoryId
                ? `Posts published ${rangeLabel} count toward this period; others are filed under the matching report month.`
                : "Choose a post type above first."}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={locked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <UploadIcon className="w-4 h-4" />
            Choose file
          </Button>
        </div>
      </label>

      {fileName && status !== "idle" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate">{fileName}</span>
            <span className="text-muted-foreground">
              {status === "uploading" && "Uploading and validating..."}
              {status === "done" && "Accepted"}
              {status === "error" && "Rejected"}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      ) : null}

      {outcome?.ok && outcome.post ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div className="font-medium">Post recorded</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {outcome.post.categoryName ? (
              <Stat label="Post type" value={outcome.post.categoryName} />
            ) : null}
            <Stat label="Post date" value={formatPostDate(outcome.post.postDate)} />
            <Stat label="Publish time" value={outcome.post.postPublishTime ?? "—"} />
            <Stat label="Reach" value={formatNumber(outcome.post.reach)} />
            <Stat label="Impressions" value={formatNumber(outcome.post.impressions)} />
          </div>
          {outcome.post.postUrl ? (
            <a
              href={outcome.post.postUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
              View on LinkedIn
            </a>
          ) : null}
        </div>
      ) : null}

      {outcome && !outcome.ok ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-destructive" />
            Upload rejected
          </div>
          <p className="text-sm text-muted-foreground">{outcome.message}</p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="text-base font-medium mt-1">{value}</div>
    </div>
  );
}

function formatPostDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
