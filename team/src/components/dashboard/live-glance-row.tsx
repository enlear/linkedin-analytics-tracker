"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LiveLeaderboard, type LiveLeaderboardProps } from "./live-leaderboard";

/**
 * Top dashboard row: the live board beside a companion card (the month
 * glance, or the upload prompt in the empty state).
 *
 * Collapsed, the two cards stretch to one shared height. When the board is
 * expanded it grows downwards on its own — the companion card keeps the exact
 * size and position it had, instead of stretching into a tall, mostly empty
 * card with its content floating in the middle.
 */
export function LiveGlanceRow({
  board,
  children,
}: {
  board: Omit<LiveLeaderboardProps, "expanded" | "onExpandedChange">;
  /** The companion card. Should fill its box (h-full). */
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pinnedHeight, setPinnedHeight] = useState<number | null>(null);
  const sideRef = useRef<HTMLDivElement>(null);

  function handleExpandedChange(next: boolean) {
    // Capture the companion's current (stretched) height before the row
    // stops stretching, so it stays exactly as it was.
    setPinnedHeight(next && sideRef.current ? sideRef.current.offsetHeight : null);
    setExpanded(next);
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-12", expanded ? "items-start" : "items-stretch")}>
      <div className="min-w-0 lg:col-span-7">
        <LiveLeaderboard
          {...board}
          expanded={expanded}
          onExpandedChange={handleExpandedChange}
        />
      </div>
      <div
        ref={sideRef}
        className="min-w-0 lg:col-span-5 [&>*]:h-full"
        style={pinnedHeight != null ? { height: pinnedHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
