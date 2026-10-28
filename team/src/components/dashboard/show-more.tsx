"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShowMoreToggleProps {
  expanded: boolean;
  hiddenCount: number;
  itemLabel?: string;
  onToggle: () => void;
  className?: string;
}

export function ShowMoreToggle({
  expanded,
  hiddenCount,
  itemLabel = "more",
  onToggle,
  className,
}: ShowMoreToggleProps) {
  if (hiddenCount <= 0 && !expanded) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground border-t border-border flex items-center justify-center gap-1.5",
        className,
      )}
    >
      {expanded ? (
        <>
          <ChevronUp className="w-4 h-4" /> Show less
        </>
      ) : (
        <>
          <ChevronDown className="w-4 h-4" /> Show {hiddenCount} more {itemLabel}
        </>
      )}
    </button>
  );
}
