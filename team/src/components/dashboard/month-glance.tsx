import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { Donut } from "./donut";
import type { RankedEmployee } from "@/lib/monthly-stats";

interface Props {
  /** The viewer's line in the current-period ranking (null if not on it). */
  me: RankedEmployee | null;
  /** Full current-period ranking. */
  rows: RankedEmployee[];
}

/**
 * Three rings that answer "how am I doing this month?" at a glance: my score,
 * my slice of the team's reach, and how much of the team has posted.
 */
export function MonthGlance({ me, rows }: Props) {
  const participants = rows.filter((r) => r.postCount > 0).length;
  const total = rows.length;
  const teamReach = rows.reduce((s, r) => s + r.totalReach, 0);
  const myReach = me?.totalReach ?? 0;
  const share = teamReach > 0 ? myReach / teamReach : 0;
  const ranked = me != null && me.postCount > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          Your month at a glance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        <div className="grid grid-cols-3 gap-3 w-full">
          <Ring
            value={ranked ? me.score : 0}
            colorClassName="text-amber-600 dark:text-amber-400"
            center={ranked ? me.score.toFixed(2) : "—"}
            label="Performance score"
            sub={ranked ? `Rank #${me.rank} of ${participants}` : "Not ranked yet"}
          />
          <Ring
            value={share}
            colorClassName="text-primary"
            center={`${Math.round(share * 100)}%`}
            label="Share of team reach"
            sub={`${formatNumber(myReach)} of ${formatNumber(teamReach)}`}
          />
          <Ring
            value={total > 0 ? participants / total : 0}
            colorClassName="text-emerald-600 dark:text-emerald-400"
            center={`${participants}/${total}`}
            label="Teammates posted"
            sub={
              total - participants > 0
                ? `${total - participants} yet to upload`
                : "Everyone's in"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Ring({
  value,
  colorClassName,
  center,
  label,
  sub,
}: {
  value: number;
  colorClassName: string;
  center: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <Donut value={value} size={84} stroke={8} colorClassName={colorClassName}>
        <span className="text-base font-bold tabular-nums leading-none">{center}</span>
      </Donut>
      <div className="mt-2.5 text-xs font-medium leading-tight">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-tight">{sub}</div>
    </div>
  );
}
