"use client";

import type { JSX } from "react";
import type { StockStats } from "@/lib/stats";
import { shouldShowCurrency } from "@/lib/stocks";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { GlossaryTooltip } from "@/components/GlossaryTooltip";
import type { GlossaryTermId } from "@/lib/glossary";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the StatsCards component.
 */
export type StatsCardsProps = {
  /** Stock statistics to display */
  stats: StockStats;
  /** Optional symbol to determine currency formatting */
  symbol?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(value: number, showCurrency: boolean = true): string {
  return showCurrency ? formatCurrency(value) : formatNumber(value);
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
export function StatsCards({ stats, symbol }: StatsCardsProps): JSX.Element {
  const showCurrency = !symbol || shouldShowCurrency(symbol);

  return (
    <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-1">
      <StatCard
        label="Last Close"
        value={formatPrice(stats.lastClose, showCurrency)}
        valueClass="text-neutral-100"
        termId="last_close"
      />
      <StatCard
        label="1M Return"
        value={formatPercent(stats.oneMonthReturn)}
        valueClass={getReturnColor(stats.oneMonthReturn)}
        termId="trailing_return"
      />
      <StatCard
        label="3M Return"
        value={formatPercent(stats.threeMonthReturn)}
        valueClass={getReturnColor(stats.threeMonthReturn)}
        termId="trailing_return"
      />
      <StatCard
        label="Volatility"
        value={formatPercent(stats.annualizedVolatility)}
        valueClass="text-amber-400"
        subtitle="Annualized"
        termId="volatility_annualised"
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
  termId?: GlossaryTermId;
};

/**
 * Individual statistic card with label and value.
 */
function StatCard({
  label,
  value,
  valueClass = "text-neutral-100",
  subtitle,
  termId,
}: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-3 transition-colors hover:border-neutral-600/50 hover:bg-neutral-800/50">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-neutral-400 flex items-center gap-1">
          {label}
          {termId && <GlossaryTooltip termId={termId} />}
        </span>
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
