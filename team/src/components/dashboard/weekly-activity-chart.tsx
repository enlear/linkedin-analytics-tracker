"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface WeeklyActivityPoint {
  week: string; // "Aug 20"
  you: number;
  others: number;
}

/**
 * Posts published per week of the tracking period, stacked: your posts on the
 * bottom in the primary colour, the rest of the team above in a tint. Bar
 * height is the team total, so you see both the team's rhythm and your part.
 */
export function WeeklyActivityChart({
  data,
  height = 220,
}: {
  data: WeeklyActivityPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Legend verticalAlign="top" height={26} wrapperStyle={{ fontSize: "0.75rem" }} />
        <Bar dataKey="you" name="You" stackId="posts" fill="hsl(var(--primary))" />
        <Bar
          dataKey="others"
          name="Rest of team"
          stackId="posts"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
