"use client";

import dynamic from "next/dynamic";
import type { EmployeeHistoryPoint } from "./employee-history-chart";

// Next.js 15 forbids `next/dynamic` with `ssr: false` inside Server Components.
// Wrapping the dynamic call in this "use client" file moves it to the client
// side, satisfying the build while still keeping recharts out of SSR (recharts
// reads `window` / `ResizeObserver` at module load, which crashes server render).
const EmployeeHistoryChart = dynamic(
  () =>
    import("./employee-history-chart").then((m) => m.EmployeeHistoryChart),
  { ssr: false },
);

export function EmployeeHistoryChartLazy({
  data,
  height,
}: {
  data: EmployeeHistoryPoint[];
  height?: number;
}) {
  return <EmployeeHistoryChart data={data} height={height} />;
}
