"use client";

import type { JSX } from "react";
import type { HigherMoments } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the RiskMetricsPanel component.
 */
export type RiskMetricsPanelProps = {
  /** Higher moment statistics (mean, std, skewness, kurtosis) */
  moments: HigherMoments;
  /** Annualized Sharpe ratio (null if not computable) */
  sharpeRatio: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Trading days per year for annualization */
const TRADING_DAYS_PER_YEAR = 252;

/**
 * Determines the color class for skewness value.
 * Negative skew (left tail risk) is highlighted in red.
 */
function getSkewnessColor(value: number): string {
  if (!Number.isFinite(value)) {
    return "text-neutral-200";
  }
  if (value < -0.5) return "text-red-400";
  if (value > 0.5) return "text-green-400";
  return "text-neutral-200";
}

/**
 * Determines the color class for kurtosis value.
 * High kurtosis (fat tails) is highlighted in amber.
 */
function getKurtosisColor(value: number): string {
  if (!Number.isFinite(value)) {
    return "text-neutral-200";
  }
  if (value > 1) return "text-amber-400";
  if (value < -1) return "text-blue-400";
  return "text-neutral-200";
}

/**
 * Determines the color class for Sharpe ratio.
 */
function getSharpeColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "text-neutral-200";
  }
  if (value > 1) return "text-green-400";
  if (value > 0) return "text-neutral-200";
  return "text-red-400";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Panel displaying risk metrics and return distribution statistics.
 *
 * Shows:
 * - Mean daily return (%)
 * - Annualized mean return (%)
 * - Daily volatility (%)
 * - Annualized volatility (%)
 * - Sharpe ratio
 * - Skewness
 * - Kurtosis (excess)
 *
 * @example
 * ```tsx
 * <RiskMetricsPanel moments={moments} sharpeRatio={sharpe} />
 * ```
 */
export function RiskMetricsPanel({
  moments,
  sharpeRatio,
}: RiskMetricsPanelProps): JSX.Element {
  const { mean, std, skewness, kurtosis } = moments;

  // Annualize daily metrics
  const meanAnnual = mean * TRADING_DAYS_PER_YEAR;
  const stdAnnual = std * Math.sqrt(TRADING_DAYS_PER_YEAR);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Daily Mean"
        value={formatPercent(mean)}
        valueClass="text-neutral-200"
      />
      <MetricCard
        label="Annual Mean"
        value={formatPercent(meanAnnual)}
        valueClass={meanAnnual > 0 ? "text-green-400" : meanAnnual < 0 ? "text-red-400" : "text-neutral-200"}
      />
      <MetricCard
        label="Daily Vol"
        value={formatPercent(std)}
        valueClass="text-amber-400"
      />
      <MetricCard
        label="Annual Vol"
        value={formatPercent(stdAnnual)}
        valueClass="text-amber-400"
      />
      <MetricCard
        label="Sharpe"
        value={formatNumber(sharpeRatio)}
        valueClass={getSharpeColor(sharpeRatio)}
        tooltip="Annualized risk-adjusted return"
      />
      <MetricCard
        label="Skewness"
        value={formatNumber(skewness)}
        valueClass={getSkewnessColor(skewness)}
        tooltip="<0 = left tail risk"
      />
      <MetricCard
        label="Kurtosis"
        value={formatNumber(kurtosis)}
        valueClass={getKurtosisColor(kurtosis)}
        tooltip=">0 = fat tails"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the internal MetricCard component.
 */
type MetricCardProps = {
  label: string;
  value: string;
  valueClass?: string;
  tooltip?: string;
};

/**
 * Individual metric card with label and value.
 */
function MetricCard({
  label,
  value,
  valueClass = "text-neutral-100",
  tooltip,
}: MetricCardProps): JSX.Element {
  return (
    <div
      className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-2 transition-colors hover:border-neutral-600/50 hover:bg-neutral-800/50"
      title={tooltip}
    >
      <div className="text-[10px] font-medium text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
