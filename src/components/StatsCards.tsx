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
 * Grid of cards displaying key stock statistics.
 *
 * Shows last closing price and various risk/return metrics.
 * Handles null/undefined values gracefully with placeholder text.
 */
export function StatsCards({ stats }: StatsCardsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Last Close" value={formatPrice(stats.lastClose)} />
      <StatCard label="1M Return" value={formatPct(stats.oneMonthReturn)} />
      <StatCard label="3M Return" value={formatPct(stats.threeMonthReturn)} />
      <StatCard
        label="Annualised Volatility"
        value={formatPct(stats.annualizedVolatility)}
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
};

/**
 * Individual statistic card with label and value.
 */
function StatCard({ label, value }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
