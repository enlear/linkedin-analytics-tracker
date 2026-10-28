"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

export interface EmployeeHistoryPoint {
  month: string; // "Mar 2026"
  reach: number;
  impressions: number;
  postCount: number;
}

interface Props {
  data: EmployeeHistoryPoint[];
  height?: number;
}

/**
 * Monthly aggregates over the last N months for an employee:
 *  - Bar: total reach (primary metric)
 *  - Bar: total impressions
 *  - Line: post count (right axis, secondary signal)
 *
 * Side-by-side bars are clearer than stacked here because reach and
 * impressions are often within an order of magnitude of each other for
 * individual employees, unlike at the company level.
 */
export function EmployeeHistoryChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(n) => formatNumber(n)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            color: "hsl(var(--popover-foreground))",
          }}
          formatter={(v: number, name) =>
            name === "Posts" ? [String(v), name] : [formatNumber(v), name]
          }
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: "0.75rem" }}
        />
        <Bar
          yAxisId="left"
          dataKey="reach"
          name="Reach"
          fill="hsl(var(--primary))"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          yAxisId="left"
          dataKey="impressions"
          name="Impressions"
          fill="hsl(var(--primary))"
          fillOpacity={0.35}
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="postCount"
          name="Posts"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
