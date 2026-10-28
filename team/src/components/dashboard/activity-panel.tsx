"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ShowMoreToggle } from "./show-more";
import { cn } from "@/lib/utils";

type ActivityRow = {
  id: string;
  action: "upload_accepted" | "upload_rejected" | "upload_deleted";
  file_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  employee: { name: string | null; email: string } | null;
};

interface Props {
  items: ActivityRow[];
  initialCount?: number;
}

export function ActivityPanel({ items, initialCount = 6 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hidden = Math.max(0, items.length - initialCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No upload activity yet.
          </div>
        ) : (
          <ul
            className={cn(
              "divide-y divide-border",
              expanded && "max-h-[28rem] overflow-y-auto",
            )}
          >
            {visible.map((item) => {
              const accepted = item.action === "upload_accepted";
              const deleted = item.action === "upload_deleted";
              const Icon = accepted ? CheckCircle2 : deleted ? Trash2 : AlertCircle;
              const color = accepted
                ? "text-emerald-500"
                : deleted
                  ? "text-amber-500"
                  : "text-destructive";
              const who = item.employee?.name ?? item.employee?.email ?? "Someone";
              const verb = accepted
                ? "uploaded"
                : deleted
                  ? "removed"
                  : "tried to upload";
              return (
                <li key={item.id} className="px-4 py-3 flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{who}</span> {verb}
                    </div>
                    {/* break-all forces long underscored filenames to wrap
                        mid-string instead of overflowing the panel width. */}
                    <div className="text-xs text-muted-foreground mt-0.5 break-all">
                      {item.file_name ?? "a LinkedIn analytics file"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(item.created_at), "MMM d, h:mm a")}
                      {!accepted && item.details && typeof item.details.reason === "string"
                        ? ` · ${humanizeReason(item.details.reason as string)}`
                        : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <ShowMoreToggle
        expanded={expanded}
        hiddenCount={hidden}
        itemLabel="events"
        onToggle={() => setExpanded((e) => !e)}
      />
    </Card>
  );
}

function humanizeReason(reason: string): string {
  switch (reason) {
    case "out_of_range":
      return "outside tracking period";
    case "duplicate":
      return "duplicate post";
    case "missing_post_url":
    case "missing_post_date":
    case "missing_impressions":
    case "missing_reach":
      return "missing required field";
    case "invalid_post_date":
      return "invalid post date";
    case "non_numeric_impressions":
    case "non_numeric_reach":
      return "non-numeric metric";
    case "read_failed":
      return "could not read file";
    default:
      return reason.replace(/_/g, " ");
  }
}
