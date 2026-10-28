"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchInstagramInsights } from "./meta-actions";

function defaultMonthValue(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function InstagramFetchButton() {
  const [month, setMonth] = useState(defaultMonthValue());
  const [pending, startTransition] = useTransition();

  function handleFetch() {
    if (!month) {
      toast.error("Pick a report month first.");
      return;
    }
    const reportMonth = `${month}-01`;
    startTransition(async () => {
      try {
        // The action revalidates /company, so the new month shows up without
        // a separate refresh.
        const res = await fetchInstagramInsights(reportMonth);
        if (!res.ok) throw new Error(res.message);
        toast.success(res.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fetch failed.");
      }
    });
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1.5">
        <Label htmlFor="ig-fetch-month">Report month</Label>
        <Input
          id="ig-fetch-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          disabled={pending}
          className="h-9 w-44 px-3 text-sm shadow-sm"
        />
      </div>
      <Button onClick={handleFetch} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching from Graph API…
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Fetch this month
          </>
        )}
      </Button>
    </div>
  );
}
