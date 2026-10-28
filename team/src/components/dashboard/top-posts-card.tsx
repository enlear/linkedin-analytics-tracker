"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowMoreToggle } from "./show-more";
import { formatNumber } from "@/lib/utils";

interface PostRow {
  id: string;
  employee_id: string;
  file_name: string;
  post_url: string | null;
  post_date: string;
  reach: number;
  impressions: number;
}

interface Author {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  title: string;
  posts: PostRow[];
  authors: Map<string, Author>;
  initialCount?: number;
}

export function TopPostsCard({ title, posts, authors, initialCount = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? posts : posts.slice(0, initialCount);
  const hidden = Math.max(0, posts.length - initialCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {posts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No posts yet for this period.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((p) => {
              const author = authors.get(p.employee_id);
              return (
                <li key={p.id} className="px-6 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {p.post_url ? (
                        <a
                          href={p.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {p.post_url}
                        </a>
                      ) : (
                        p.file_name
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {author?.name ?? author?.email ?? "—"} ·{" "}
                      {format(new Date(p.post_date + "T00:00:00"), "MMM d")}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div className="font-medium text-foreground">
                      {formatNumber(p.reach)} reach
                    </div>
                    <div>{formatNumber(p.impressions)} impr.</div>
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
        itemLabel="posts"
        onToggle={() => setExpanded((e) => !e)}
      />
    </Card>
  );
}
