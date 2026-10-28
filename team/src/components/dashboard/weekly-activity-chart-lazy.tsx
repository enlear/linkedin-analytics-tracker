"use client";

import dynamic from "next/dynamic";
import type { WeeklyActivityPoint } from "./weekly-activity-chart";

// Same pattern as employee-history-chart-lazy: keep recharts out of SSR
// (it touches `window` at module load) without using `ssr: false` in a
// Server Component, which Next.js 15 forbids.
const WeeklyActivityChart = dynamic(
  () => import("./weekly-activity-chart").then((m) => m.WeeklyActivityChart),
  { ssr: false },
);

export function WeeklyActivityChartLazy({
  data,
  height,
}: {
  data: WeeklyActivityPoint[];
  height?: number;
}) {
  return <WeeklyActivityChart data={data} height={height} />;
}
