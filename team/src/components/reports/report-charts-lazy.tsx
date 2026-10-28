"use client";

import dynamic from "next/dynamic";

// Keep recharts out of SSR (it touches `window` at module load) without using
// `ssr: false` in a Server Component, which Next.js 15 forbids.
export const ShareDonutLazy = dynamic(
  () => import("./report-charts").then((m) => m.ShareDonut),
  { ssr: false, loading: () => <div className="h-[140px]" /> },
);

export const DailyTrendChartLazy = dynamic(
  () => import("./report-charts").then((m) => m.DailyTrendChart),
  { ssr: false, loading: () => <div className="h-[200px]" /> },
);
