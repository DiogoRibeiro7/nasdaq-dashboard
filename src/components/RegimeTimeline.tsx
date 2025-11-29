"use client";

import type { JSX } from "react";
import type { RegimePoint, MarketRegime } from "@/lib/stats";

const REGIME_COLORS: Record<MarketRegime, string> = {
  uptrend: "bg-emerald-500/70",
  downtrend: "bg-red-500/70",
  sideways: "bg-neutral-500/60",
  "high-volatility": "bg-amber-500/80",
};

export type RegimeTimelineProps = {
  regimes: RegimePoint[];
};

export function RegimeTimeline({
  regimes,
}: RegimeTimelineProps): JSX.Element {
  if (regimes.length === 0) {
    return (
      <div className="flex h-12 items-center justify-center text-xs text-neutral-400">
        Not enough data to classify regimes.
      </div>
    );
  }

  return (
    <div className="flex h-6 w-full overflow-hidden rounded-full border border-neutral-700">
      {regimes.map((point) => (
        <div
          key={point.date}
          className={`${REGIME_COLORS[point.regime]} flex-1 border-r border-neutral-800 last:border-r-0`}
          title={`${point.date}: ${point.regime}`}
        />
      ))}
    </div>
  );
}
