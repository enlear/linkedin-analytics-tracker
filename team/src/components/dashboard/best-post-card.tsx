import { format } from "date-fns";
import { ExternalLink, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { PostRowWithReportMonth } from "@/lib/monthly-stats";

/** Compact sidebar card for the viewer's highest-reach post. */
export function BestPostCard({ post }: { post: PostRowWithReportMonth }) {
  const label = post.post_url ?? post.file_name;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          Your best post
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.post_url ? (
          <a
            href={post.post_url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-1.5 text-sm font-medium hover:underline"
            title={label}
          >
            <span className="line-clamp-2 break-all">{label}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          </a>
        ) : (
          <div className="text-sm font-medium line-clamp-2 break-all" title={label}>
            {label}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Posted {format(new Date(post.post_date + "T00:00:00"), "MMM d, yyyy")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/40 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reach</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5">{formatNumber(post.reach)}</div>
          </div>
          <div className="rounded-md bg-muted/40 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Impressions</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5">
              {formatNumber(post.impressions)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
