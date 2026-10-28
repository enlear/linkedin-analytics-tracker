import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export function formatDelta(current: number, previous: number | null | undefined): {
  value: number;
  percent: number;
  direction: "up" | "down" | "flat";
} {
  if (previous == null || previous === 0) {
    return { value: current, percent: 0, direction: "flat" };
  }
  const value = current - previous;
  const percent = (value / previous) * 100;
  return {
    value,
    percent,
    direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
  };
}
