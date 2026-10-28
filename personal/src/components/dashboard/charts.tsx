"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { WeekdayStat } from "@/lib/insights";

// One series per chart, one hue (--primary). Grid and axes stay recessive so
// the data carries the contrast. Every chart has a hover tooltip.

const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";
const axis = { stroke: MUTED, fontSize: 11, tickLine: false, axisLine: false } as const;

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

function ChartTooltip({
  active,
  payload,
  label,
  title,
  format = (v) => formatNumber(v),
}: TooltipProps<number, string> & { title: (label: string) => string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground mb-0.5">{title(String(label))}</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center gap-2 font-medium text-popover-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: PRIMARY }} />
          {p.name}: {format(Number(p.value))}
        </div>
      ))}
    </div>
  );
}

export type TrendMetric = "impressions" | "engagements";

export function TrendChart({
  points,
  metric,
  bucket,
}: {
  points: { date: string; impressions: number; engagements: number }[];
  metric: TrendMetric;
  bucket: "day" | "week";
}) {
  const name = metric === "impressions" ? "Impressions" : "Engagements";
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
        <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={24} />
        <YAxis {...axis} tickFormatter={(v) => formatNumber(v)} width={48} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={<ChartTooltip title={(l) => (bucket === "week" ? `Week of ${fmtDay(l)}` : fmtDay(l))} />}
        />
        <Bar dataKey={metric} name={name} fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FollowerChart({ points }: { points: { date: string; followers: number }[] }) {
  const values = points.map((p) => p.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, Math.round((max - min) * 0.1));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="followers-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
        <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
        <YAxis {...axis} domain={[min - pad, max + pad]} tickFormatter={(v) => formatNumber(v)} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          content={<ChartTooltip title={fmtDay} format={(v) => v.toLocaleString()} />}
        />
        <Area type="monotone" dataKey="followers" name="Followers" stroke={PRIMARY} strokeWidth={2} fill="url(#followers-fill)" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WeekdayChart({ stats, best }: { stats: WeekdayStat[]; best: WeekdayStat | null }) {
  const metric = stats.some((s) => s.avgEngagements != null) ? "avgEngagements" : "avgImpressions";
  const name = metric === "avgEngagements" ? "Avg. engagements" : "Avg. impressions";
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={stats} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
        <XAxis dataKey="day" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => formatNumber(v)} width={48} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={(props) => {
            const stat = props.payload?.[0]?.payload as WeekdayStat | undefined;
            return (
              <ChartTooltip
                active={props.active}
                payload={props.payload as TooltipProps<number, string>["payload"]}
                label={props.label}
                title={(l) => `${l} · ${stat?.posts ?? 0} post${stat?.posts === 1 ? "" : "s"}`}
                format={(v) => Math.round(v).toLocaleString()}
              />
            );
          }}
        />
        <Bar dataKey={metric} name={name} radius={[4, 4, 0, 0]} maxBarSize={36}>
          {stats.map((s) => (
            // The recommended day is full strength; the rest recede.
            <Cell key={s.day} fill={PRIMARY} fillOpacity={best && s.day !== best.day ? 0.35 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
