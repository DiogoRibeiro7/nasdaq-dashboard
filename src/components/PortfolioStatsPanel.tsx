"use client";

import type { JSX } from "react";
import { formatPercent, formatAxisNumber } from "@/lib/format";
import { GlossaryTooltip } from "@/components/GlossaryTooltip";
import type { GlossaryTermId } from "@/lib/glossary";

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
      <StatCard
        label="Total Return"
        termId="total_return"
        value={formatPercent(totalReturn)}
      />
      <StatCard
        label="Volatility"
        termId="volatility_annualised"
        value={formatPercent(volatility)}
      />
      <StatCard
        label="Sharpe"
        termId="sharpe_ratio"
        value={sharpe !== null ? formatAxisNumber(sharpe) : "—"}
      />
      <StatCard
        label="Max Drawdown"
        termId="max_drawdown"
        value={formatPercent(maxDrawdown)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  termId,
}: {
  label: string;
  value: string;
  termId: GlossaryTermId;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-3">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
        <GlossaryTooltip termId={termId} />
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
