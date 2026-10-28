import { cn } from "@/lib/utils";

interface DonutProps {
  /** Fill fraction, 0–1. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  stroke?: number;
  /** Tailwind text-* class; the arc is drawn in currentColor. */
  colorClassName?: string;
  /** Centre content (value, unit). */
  children?: React.ReactNode;
  title?: string;
}

/**
 * Plain SVG ring. No charting library, so it renders on the server and needs
 * no lazy loading — it only ever shows one fraction.
 */
export function Donut({
  value,
  size = 88,
  stroke = 9,
  colorClassName = "text-primary",
  children,
  title,
}: DonutProps) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;

  return (
    <div
      className={cn("relative shrink-0", colorClassName)}
      style={{ width: size, height: size }}
      title={title}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {v > 0 ? (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-foreground">
        {children}
      </div>
    </div>
  );
}
