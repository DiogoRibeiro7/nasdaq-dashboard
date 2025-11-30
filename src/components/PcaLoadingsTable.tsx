"use client";

import type { JSX } from "react";
import type { PcaResult } from "@/lib/analytics/pca";
import { formatAxisNumber } from "@/lib/format";

export type PcaLoadingsTableProps = {
  result: PcaResult;
  components?: number;
};

export function PcaLoadingsTable({
  result,
  components = 3,
}: PcaLoadingsTableProps): JSX.Element {
  const columnCount = Math.min(components, result.loadings.length);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/50">
      <table className="min-w-full table-fixed border-collapse text-xs text-neutral-200">
        <thead className="bg-neutral-900/60 text-neutral-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Symbol</th>
            {Array.from({ length: columnCount }).map((_, index) => (
              <th
                key={index}
                className="px-3 py-2 text-right font-medium"
              >
                PC{index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.symbols.map((symbol, symbolIndex) => (
            <tr key={symbol} className="border-t border-neutral-800">
              <td className="px-3 py-2 font-semibold text-neutral-100">
                {symbol}
              </td>
              {Array.from({ length: columnCount }).map((_, componentIndex) => {
                const loading =
                  result.loadings[componentIndex]?.[symbolIndex] ?? 0;
                const colorClass =
                  loading > 0.2
                    ? "text-emerald-400"
                    : loading < -0.2
                    ? "text-red-400"
                    : "text-neutral-100";
                return (
                  <td
                    key={`${symbol}-${componentIndex}`}
                    className={`px-3 py-2 text-right font-semibold ${colorClass}`}
                  >
                    {formatAxisNumber(loading)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
