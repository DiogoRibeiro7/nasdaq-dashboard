"use client";

import type { JSX } from "react";
import { formatAxisNumber, formatPercent } from "@/lib/format";

export type StrategyComparisonRow = {
  name: string;
  totalReturn: number | null;
  maxDrawdown: number | null;
  cagr: number | null;
  hitRate: number | null;
};

export type StrategyComparisonTableProps = {
  rows: StrategyComparisonRow[];
};

export function StrategyComparisonTable({
  rows,
}: StrategyComparisonTableProps): JSX.Element | null {
  if (rows.length === 0) {
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
            <th className="px-3 py-2 text-right font-medium">Hit rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-neutral-800">
              <td className="px-3 py-2 font-semibold text-neutral-100">
                {row.name}
              </td>
              <td className="px-3 py-2 text-right">
                {row.totalReturn !== null
                  ? formatPercent(row.totalReturn)
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {row.maxDrawdown !== null
                  ? formatPercent(row.maxDrawdown)
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {row.cagr !== null ? formatPercent(row.cagr) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {row.hitRate !== null
                  ? formatPercent(row.hitRate)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
