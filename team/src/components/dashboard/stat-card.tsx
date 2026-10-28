import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | null;
  delta?: { value: number; percent: number; direction: "up" | "down" | "flat" };
  hint?: string;
}

export function StatCard({ label, value, delta, hint }: StatCardProps) {
  const Icon = delta?.direction === "up" ? ArrowUp : delta?.direction === "down" ? ArrowDown : ArrowRight;
  const deltaColor =
    delta?.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : delta?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground min-h-8 leading-4">
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-3xl font-semibold">{value == null ? "—" : formatNumber(value)}</div>
          {delta && value != null ? (
            <div className={cn("flex items-center gap-0.5 text-sm", deltaColor)}>
              <Icon className="w-3.5 h-3.5" />
              {Math.abs(delta.percent).toFixed(1)}%
            </div>
          ) : null}
        </div>
        {hint ? <div className="text-xs text-muted-foreground mt-2">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
