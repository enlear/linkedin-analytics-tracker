"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { TiktokDailyMetricRow } from "@/lib/data/company-analytics";

interface Props {
  metrics: TiktokDailyMetricRow[];
  previousMetrics?: TiktokDailyMetricRow[];
  currentLabel: string;
  previousLabel?: string | null;
}

/**
 * Mirrors CompanyDailyChart's day-of-month overlay pattern. We chart
 * videoViews because it has the largest scale on TikTok and is the most
 * visible movement month-over-month.
 */
export function TiktokDailyChart({
  metrics,
  previousMetrics = [],
  currentLabel,
  previousLabel,
}: Props) {
  const byDay = new Map<number, { day: number; current?: number; previous?: number }>();
  for (const m of metrics) {
    const day = parseInt(m.date.slice(8, 10), 10);
    const row = byDay.get(day) ?? { day };
    row.current = m.videoViews;
    byDay.set(day, row);
  }
  for (const m of previousMetrics) {
    const day = parseInt(m.date.slice(8, 10), 10);
    const row = byDay.get(day) ?? { day };
    row.previous = m.videoViews;
    byDay.set(day, row);
  }
  const data = [...byDay.values()].sort((a, b) => a.day - b.day);

  const hasPrevious = previousMetrics.length > 0;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          interval={1}
          tickFormatter={(d: number) => String(d).padStart(2, "0")}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(n) => formatNumber(n)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            color: "hsl(var(--popover-foreground))",
          }}
          labelFormatter={(d: number) => `Day ${String(d).padStart(2, "0")}`}
          formatter={(v: number) => formatNumber(v)}
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: "0.75rem" }}
        />
        {hasPrevious ? (
          <Line
            type="monotone"
            dataKey="previous"
            name={previousLabel ?? "Previous month"}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="current"
          name={currentLabel}
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
