"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFiles: (files: File[]) => Promise<void>;
  compact?: boolean;
}

/** Drag-and-drop or click-to-pick for one or more .xlsx exports. */
export function Dropzone({ onFiles, compact }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      await onFiles(files);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files);
      }}
      disabled={busy}
      className={cn(
        "w-full rounded-xl border-2 border-dashed text-center transition-colors",
        "hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging ? "border-primary bg-primary/5" : "border-border",
        compact ? "px-4 py-5" : "px-6 py-12",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      <div className="flex flex-col items-center gap-2">
        {busy ? (
          <FileSpreadsheet className="h-8 w-8 text-primary animate-pulse" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="font-medium">{busy ? "Reading your export…" : "Drop your LinkedIn export here"}</div>
        <div className="text-sm text-muted-foreground">
          or click to choose the .xlsx file. You can add several exports at once.
        </div>
      </div>
    </button>
  );
}
