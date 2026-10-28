"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShowMoreToggle } from "./show-more";
import { DeletePostButton } from "./delete-post-button";
import { AdminDeletePostButton } from "./admin-delete-post-button";
import { formatNumber } from "@/lib/utils";

export interface UploadedPostRow {
  id: string;
  file_name: string;
  post_url: string | null;
  post_date: string;
  post_publish_time: string | null;
  impressions: number;
  reach: number;
  uploaded_at: string;
  validation_status: "accepted" | "rejected";
  rejection_reason: string | null;
  /** Null for uncategorised posts (pre-categories uploads, API syncs). */
  category_name?: string | null;
}

interface Props {
  title: string;
  posts: UploadedPostRow[];
  initialCount: number;
  showUploadedAt?: boolean;
  allowDelete?: boolean;
  // Admin-side delete (no period restriction). Used on /team/[id]. When set
  // along with allowDelete, every row gets the admin-delete button.
  adminDelete?: boolean;
}

export function EmployeeUploadsTable({
  title,
  posts,
  initialCount,
  showUploadedAt = false,
  allowDelete = false,
  adminDelete = false,
}: Props) {
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
            Nothing to show yet.
          </div>
        ) : (
          <div>
            {/* table-fixed + w-full keeps the table exactly the card's width so
                it can never overflow horizontally — no wrapper scroll needed.
                The Post column flexes and truncates; secondary columns drop
                away on narrower screens so the action button stays reachable. */}
            <table className="w-full table-fixed text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium px-3 sm:px-4 py-3">Post</th>
                  <th className="text-left font-medium px-3 sm:px-4 py-3 w-24 sm:w-28">Posted</th>
                  {showUploadedAt ? (
                    <th className="text-left font-medium px-3 sm:px-4 py-3 w-24 hidden lg:table-cell">
                      Uploaded
                    </th>
                  ) : null}
                  <th className="text-right font-medium px-3 sm:px-4 py-3 w-16">Reach</th>
                  <th className="text-right font-medium px-3 sm:px-4 py-3 w-20 hidden md:table-cell">
                    Impressions
                  </th>
                  <th className="text-right font-medium px-3 sm:px-4 py-3 w-24 sm:w-28">Status</th>
                  {allowDelete ? (
                    <th className="text-right font-medium px-3 sm:px-4 py-3 w-16">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 align-middle">
                    <td className="px-3 sm:px-4 py-3">
                      {p.post_url ? (
                        <a
                          href={p.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:underline min-w-0"
                        >
                          <span className="truncate">{p.post_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground truncate block">{p.file_name}</span>
                      )}
                      {p.category_name ? (
                        <Badge variant="secondary" className="mt-1 max-w-full truncate">
                          {p.category_name}
                        </Badge>
                      ) : null}
                      {showUploadedAt ? (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p.file_name}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-muted-foreground">
                      {format(new Date(p.post_date + "T00:00:00"), "MMM d, yyyy")}
                      {p.post_publish_time ? (
                        <div className="text-xs">{p.post_publish_time}</div>
                      ) : null}
                    </td>
                    {showUploadedAt ? (
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {format(new Date(p.uploaded_at), "MMM d, h:mm a")}
                      </td>
                    ) : null}
                    <td className="px-3 sm:px-4 py-3 text-right font-medium">
                      {formatNumber(p.reach)}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                      {formatNumber(p.impressions)}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right">
                      {p.validation_status === "accepted" ? (
                        <Badge variant="success">Accepted</Badge>
                      ) : (
                        <div>
                          <Badge variant="destructive">Rejected</Badge>
                          {p.rejection_reason ? (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {p.rejection_reason}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    {allowDelete ? (
                      <td className="px-3 sm:px-4 py-3 text-right">
                        {adminDelete ? (
                          <AdminDeletePostButton
                            postId={p.id}
                            postLabel={p.post_url ?? p.file_name}
                          />
                        ) : (
                          <DeletePostButton
                            postId={p.id}
                            postLabel={p.post_url ?? p.file_name}
                          />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
