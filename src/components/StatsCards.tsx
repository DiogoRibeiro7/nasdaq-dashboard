"use client";

import type { StockStats } from "@/lib/stats";

type StatsCardsProps = {
  stats: StockStats;
};

function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

/**
 * Small cards summarising stock statistics.
 */
export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="text-xs text-neutral-400">Last Close</div>
        <div className="text-lg font-semibold">
          {formatPrice(stats.lastClose)}
        </div>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="text-xs text-neutral-400">1M Return</div>
        <div className="text-lg font-semibold">
          {formatPct(stats.oneMonthReturn)}
        </div>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="text-xs text-neutral-400">3M Return</div>
        <div className="text-lg font-semibold">
          {formatPct(stats.threeMonthReturn)}
        </div>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="text-xs text-neutral-400">
          Annualised Volatility
        </div>
        <div className="text-lg font-semibold">
          {formatPct(stats.annualizedVolatility)}
        </div>
      </div>
    </div>
  );
}
