// Server-rendered visual building blocks for the company monthly report.
// Plain HTML/CSS — no charting library — so they render on the server and
// print exactly as shown.

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { pctChange, type Kpi, type PlatformReport } from "@/lib/company-report";

export function formatValue(value: number, format: Kpi["format"] = "number"): string {
  return format === "percent" ? `${(value * 100).toFixed(2)}%` : formatNumber(value);
}

/** ↑ 12% / ↓ 5% / flat. Direction is always shown with an arrow, never colour alone. */
export function DeltaBadge({
  change,
  className,
}: {
  change: number | null;
  className?: string;
}) {
  if (change == null) {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>no prior data</span>
    );
  }
  if (Math.abs(change) < 0.5) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs text-muted-foreground", className)}>
        <Minus className="w-3 h-3" /> flat
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(change) >= 1000 ? ">999" : Math.abs(change).toFixed(0)}%
    </span>
  );
}

/** Large overview tile. */
export function HeadlineTile({
  label,
  value,
  change,
  sub,
}: {
  label: string;
  value: string;
  change: number | null;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-4 print:break-inside-avoid">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <DeltaBadge change={change} />
        {sub ? <span className="truncate">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Compact per-platform metric tile with its change vs last month. */
export function KpiCell({ kpi, prevLabel }: { kpi: Kpi; prevLabel: string }) {
  const change = pctChange(kpi.value, kpi.previous);
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 print:break-inside-avoid">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
        {kpi.label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums leading-none">
          {formatValue(kpi.value, kpi.format)}
        </span>
        <DeltaBadge change={change} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {kpi.previous != null ? `${prevLabel}: ${formatValue(kpi.previous, kpi.format)}` : " "}
      </div>
    </div>
  );
}

/**
 * Diverging bar centred on zero: grows right in green for growth, left in red
 * for decline. Capped at ±100% so one outlier can't flatten the rest.
 */
export function DeltaBar({ change }: { change: number | null }) {
  const pct = change == null ? 0 : Math.min(100, Math.abs(change));
  const up = (change ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative h-2 flex-1 min-w-[4rem] rounded-full bg-muted">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        {change != null && pct > 0 ? (
          <div
            className={cn(
              "absolute inset-y-0 rounded-full",
              up ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500",
            )}
            style={{ width: `${pct / 2}%` }}
          />
        ) : null}
      </div>
      <DeltaBadge change={change} className="w-14 justify-end shrink-0" />
    </div>
  );
}

/** Month-over-month comparison: one row per platform, bars instead of columns of numbers. */
export function ComparisonTable({
  reports,
  prevLabel,
}: {
  reports: PlatformReport[];
  prevLabel: string;
}) {
  return (
    <div className="rounded-xl border overflow-hidden print:break-inside-avoid">
      <table className="w-full text-sm table-fixed">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-4 py-2 w-32">Platform</th>
            <th className="text-left font-medium px-4 py-2">Views vs {prevLabel}</th>
            <th className="text-left font-medium px-4 py-2">Engagements vs {prevLabel}</th>
            <th className="text-left font-medium px-4 py-2 hidden md:table-cell print:table-cell">
              Reach vs {prevLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.platform} className="border-t">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  {r.label}
                </div>
              </td>
              <MetricCell value={r.views.current} change={pctChange(r.views.current, r.views.previous)} />
              <MetricCell
                value={r.engagements.current}
                change={pctChange(r.engagements.current, r.engagements.previous)}
              />
              {r.reach ? (
                <MetricCell
                  value={r.reach.current}
                  change={pctChange(r.reach.current, r.reach.previous)}
                  className="hidden md:table-cell print:table-cell"
                />
              ) : (
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell print:table-cell">
                  not reported
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCell({
  value,
  change,
  className,
}: {
  value: number;
  change: number | null;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3", className)}>
      <div className="text-sm font-semibold tabular-nums mb-1">{formatNumber(value)}</div>
      <DeltaBar change={change} />
    </td>
  );
}

/** 100%-stacked horizontal bar with a legend (e.g. organic vs sponsored). */
export function SplitBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string }>;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <div className="text-sm text-muted-foreground">No data.</div>;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {parts.map((p) =>
          p.value > 0 ? (
            <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-medium tabular-nums">
              {formatNumber(p.value)} · {((p.value / total) * 100).toFixed(0)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars (content mix, top posts). */
export function HBarList({
  items,
  color,
  valueLabel,
}: {
  items: Array<{ label: string; value: number; sub?: string }>;
  color: string;
  valueLabel?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i, idx) => (
        <li key={`${i.label}-${idx}`} className="print:break-inside-avoid">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={i.label}>
              {i.label}
            </span>
            <span className="font-medium tabular-nums shrink-0">
              {valueLabel ? valueLabel(i.value) : formatNumber(i.value)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }}
            />
          </div>
          {i.sub ? <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{i.sub}</div> : null}
        </li>
      ))}
    </ul>
  );
}
