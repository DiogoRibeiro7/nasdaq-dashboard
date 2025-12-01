"use client";

import type { JSX } from "react";
import type { PortfolioBacktestResult } from "@/lib/analytics/portfolio_backtest";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import type { BacktestResult } from "@/lib/stats";
import { formatPercent } from "@/lib/format";

export type PortfolioBacktestPanelProps = {
  result: PortfolioBacktestResult | null;
  symbols: string[];
};

export function PortfolioBacktestPanel({
  result,
  symbols,
}: PortfolioBacktestPanelProps): JSX.Element {
  if (!result || result.equityCurve.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
        Configure weights and frequency to run the custom backtest.
      </div>
    );
  }

  const backtestView: BacktestResult = {
    trades: [],
    equityCurve: result.equityCurve,
    totalReturn: result.totalReturn,
    maxDrawdown: result.maxDrawdown,
    cagr: result.cagr,
  };

  const snapshots = selectSnapshots(result.weightsOverTime);

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <SummaryCard label="Total return" value={formatPercent(result.totalReturn)} />
        <SummaryCard label="Max drawdown" value={formatPercent(result.maxDrawdown)} />
        <SummaryCard
          label="CAGR"
          value={result.cagr !== null ? formatPercent(result.cagr) : "—"}
        />
        <SummaryCard
          label="Turnover"
          value={formatPercent(result.turnover)}
        />
      </div>
      <EquityCurveChart result={backtestView} />
      <div>
        <h4 className="text-sm font-semibold text-neutral-100">Weights over time</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-xs text-neutral-400">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-2 py-1 font-medium">Date</th>
                {symbols.map((symbol) => (
                  <th key={symbol} className="px-2 py-1 font-medium">
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.date} className="border-t border-neutral-800/50">
                  <td className="px-2 py-1 font-semibold text-neutral-100">
                    {snapshot.date}
                  </td>
                  {symbols.map((symbol) => (
                    <td key={symbol} className="px-2 py-1">
                      {formatPercent(snapshot.weights[symbol] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function selectSnapshots(
  weightsOverTime: { date: string; weights: Record<string, number> }[],
): { date: string; weights: Record<string, number> }[] {
  if (weightsOverTime.length === 0) {
    return [];
  }
  const indices = [0, Math.floor(weightsOverTime.length / 2), weightsOverTime.length - 1];
  const seen = new Set<number>();
  const snapshots: { date: string; weights: Record<string, number> }[] = [];
  for (const idx of indices) {
    if (seen.has(idx)) continue;
    seen.add(idx);
    snapshots.push(weightsOverTime[idx]);
  }
  return snapshots;
}
