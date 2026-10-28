"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { DailyPoint } from "@/lib/company-report";

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.375rem",
  fontSize: "0.8125rem",
  color: "hsl(var(--popover-foreground))",
};

export interface ShareSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut of each platform's share of a total, with a labelled legend beside it
 * (value + share) so the numbers never depend on reading slice angles.
 */
export function ShareDonut({
  data,
  centerValue,
  centerLabel,
}: {
  data: ShareSlice[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[140px] h-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.length ? slices : [{ label: "none", value: 1, color: "hsl(var(--muted))" }]}
              dataKey="value"
              nameKey="label"
              innerRadius={46}
              outerRadius={66}
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {(slices.length ? slices : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {slices.length ? (
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name) => [formatNumber(v), name]}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold tabular-nums leading-none">{centerValue}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
            {centerLabel}
          </span>
        </div>
      </div>
      <ul className="space-y-2 min-w-0 flex-1">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="truncate">{d.label}</span>
            <span className="ml-auto tabular-nums font-medium">{formatNumber(d.value)}</span>
            <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * This month's daily series as a filled area in the platform colour, with last
 * month's same days as a dashed grey line on top — the comparison is read
 * straight off the chart, day by day.
 */
export function DailyTrendChart({
  data,
  color,
  metricLabel,
  currentLabel,
  previousLabel,
  height = 200,
}: {
  data: DailyPoint[];
  color: string;
  metricLabel: string;
  currentLabel: string;
  previousLabel: string;
  height?: number;
}) {
  const hasPrevious = data.some((d) => d.previous != null);
  const gradientId = `trend-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tickFormatter={(n) => formatNumber(n)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => `Day ${d}`}
          formatter={(v: number, name) => [formatNumber(v), name]}
        />
        <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: "0.75rem" }} />
        <Area
          type="monotone"
          dataKey="current"
          name={`${metricLabel} · ${currentLabel}`}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          connectNulls
          isAnimationActive={false}
        />
        {hasPrevious ? (
          <Line
            type="monotone"
            dataKey="previous"
            name={previousLabel}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
