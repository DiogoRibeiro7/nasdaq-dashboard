"use client";

import type { JSX } from "react";
import { formatPercent, formatAxisNumber } from "@/lib/format";

export type PortfolioStatsPanelProps = {
  volatility: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  totalReturn: number | null;
};

export function PortfolioStatsPanel({
  volatility,
  sharpe,
  maxDrawdown,
  totalReturn,
}: PortfolioStatsPanelProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total Return" value={formatPercent(totalReturn)} />
      <StatCard label="Volatility" value={formatPercent(volatility)} />
      <StatCard label="Sharpe" value={sharpe !== null ? formatAxisNumber(sharpe) : "—"} />
      <StatCard label="Max Drawdown" value={formatPercent(maxDrawdown)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
