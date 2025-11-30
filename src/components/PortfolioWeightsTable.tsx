"use client";

import type { JSX } from "react";
import type { FrontierPoint } from "@/lib/analytics/portfolio_opt";
import { formatPercent } from "@/lib/format";

export type PortfolioWeightsTableProps = {
  point?: FrontierPoint | null;
  symbols: string[];
  title?: string;
};

export function PortfolioWeightsTable({
  point,
  symbols,
  title,
}: PortfolioWeightsTableProps): JSX.Element {
  if (!point) {
    return (
      <div className="text-sm text-neutral-500">
        Select at least two tickers with sufficient overlapping history.
      </div>
    );
  }

  const rows = symbols
    .map((symbol) => ({
      symbol,
      weight: point.weights[symbol] ?? 0,
    }))
    .filter((row) => Math.abs(row.weight) > 0.0005)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  if (rows.length === 0) {
    return <div className="text-xs text-neutral-500">All weights are below 0.1%.</div>;
  }

  return (
    <div>
      {title && (
        <div className="mb-2 text-sm font-semibold text-neutral-100">
          {title}
        </div>
      )}
      <table className="w-full text-left text-xs text-neutral-300">
        <thead>
          <tr className="text-neutral-500">
            <th className="pb-2 font-medium">Symbol</th>
            <th className="pb-2 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-neutral-800/60">
              <td className="py-1.5 font-semibold text-neutral-100">{row.symbol}</td>
              <td className="py-1.5 text-right text-neutral-100">
                {formatPercent(row.weight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
