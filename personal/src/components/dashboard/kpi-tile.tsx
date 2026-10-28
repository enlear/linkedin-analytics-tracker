import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: number | null;
  /** Same metric for the comparison period; drives the change line. */
  previous?: number | null;
  /** e.g. "Aug" — printed as "vs Aug". */
  previousLabel?: string;
  icon?: LucideIcon;
}

/**
 * Compact metric tile — about half the height of StatCard, so four sit in a
 * row next to the charts without dominating the page.
 */
export function KpiTile({ label, value, previous, previousLabel, icon: Icon }: KpiTileProps) {
  let change: React.ReactNode = null;
  if (value != null && previous != null) {
    if (previous === 0) {
      change =
        value > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">up from 0</span>
        ) : null;
    } else {
      const pct = ((value - previous) / previous) * 100;
      const up = pct > 0;
      const flat = Math.abs(pct) < 0.5;
      change = flat ? (
        <span className="text-muted-foreground">no change</span>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(pct).toFixed(0)}%
        </span>
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </div>
        {Icon ? (
          <div className="w-7 h-7 rounded-md bg-muted/70 text-muted-foreground flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums leading-none">
        {value == null ? "—" : formatNumber(value)}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground min-h-4">
        {change ? (
          <>
            {change}
            {previousLabel && previous !== 0 ? <span> vs {previousLabel}</span> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
