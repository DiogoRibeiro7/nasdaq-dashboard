"use client";

import type { JSX } from "react";
import { formatPercent } from "@/lib/format";
import type { BacktestResult } from "@/lib/stats";

export type StrategyComparisonTableProps = {
  strategies: Array<{
    name: string;
    result: BacktestResult;
  }>;
};

export function StrategyComparisonTable({
  strategies,
}: StrategyComparisonTableProps): JSX.Element | null {
  if (strategies.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="min-w-full table-fixed border-collapse text-xs text-neutral-300">
        <thead className="bg-neutral-900/70 text-neutral-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Strategy</th>
            <th className="px-3 py-2 text-right font-medium">Total Return</th>
            <th className="px-3 py-2 text-right font-medium">Max Drawdown</th>
            <th className="px-3 py-2 text-right font-medium">CAGR</th>
            <th className="px-3 py-2 text-right font-medium">Sharpe</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map(({ name, result }) => (
            <tr key={name} className="border-t border-neutral-800">
              <td className="px-3 py-2 font-semibold text-neutral-100">{name}</td>
              <td className="px-3 py-2 text-right">
                {formatPercent(result.totalReturn)}
              </td>
              <td className="px-3 py-2 text-right">
                {formatPercent(result.maxDrawdown)}
              </td>
              <td className="px-3 py-2 text-right">
                {result.cagr !== null ? formatPercent(result.cagr) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {"—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
