"use client";

import type { JSX } from "react";
import type { StockStats } from "@/lib/stats";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the StatsCards component.
 */
export type StatsCardsProps = {
  /** Stock statistics to display */
  stats: StockStats;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a percentage value for display.
 * Returns "—" for null or NaN values.
 *
 * @param value - Decimal value (e.g., 0.10 for 10%)
 * @returns Formatted percentage string (e.g., "10.00%")
 */
function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Formats a price value for display.
 * Returns "—" for non-finite values.
 *
 * @param value - Price in dollars
 * @returns Formatted price string (e.g., "$150.25")
 */
function formatPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the color class for a return value.
 */
function getReturnColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "text-neutral-200";
  }
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-400";
  return "text-neutral-200";
}

/**
 * Grid of cards displaying key stock statistics.
 *
 * Shows last closing price and various risk/return metrics.
 * Handles null/undefined values gracefully with placeholder text.
 */
export function StatsCards({ stats }: StatsCardsProps): JSX.Element {
  return (
    <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-1">
      <StatCard
        label="Last Close"
        value={formatPrice(stats.lastClose)}
        valueClass="text-neutral-100"
      />
      <StatCard
        label="1M Return"
        value={formatPct(stats.oneMonthReturn)}
        valueClass={getReturnColor(stats.oneMonthReturn)}
      />
      <StatCard
        label="3M Return"
        value={formatPct(stats.threeMonthReturn)}
        valueClass={getReturnColor(stats.threeMonthReturn)}
      />
      <StatCard
        label="Volatility"
        value={formatPct(stats.annualizedVolatility)}
        valueClass="text-amber-400"
        subtitle="Annualized"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the internal StatCard component.
 */
type StatCardProps = {
  label: string;
  value: string;
  valueClass?: string;
  subtitle?: string;
};

/**
 * Individual statistic card with label and value.
 */
function StatCard({
  label,
  value,
  valueClass = "text-neutral-100",
  subtitle,
}: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-3 transition-colors hover:border-neutral-600/50 hover:bg-neutral-800/50">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-neutral-400">{label}</span>
        {subtitle && (
          <span className="text-[10px] text-neutral-500">{subtitle}</span>
        )}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
