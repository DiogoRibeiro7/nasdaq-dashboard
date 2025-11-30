"use client";

import type { JSX } from "react";
import type { LjungBoxResult } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

export type LjungBoxTableProps = {
  results: LjungBoxResult[];
};

export function LjungBoxTable({
  results,
}: LjungBoxTableProps): JSX.Element {
  if (results.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Not enough data to compute Ljung–Box statistics.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs text-neutral-200">
        <thead>
          <tr className="text-neutral-400">
            <th className="border-b border-neutral-800 px-2 py-1 text-left font-medium">
              Lag
            </th>
            <th className="border-b border-neutral-800 px-2 py-1 text-left font-medium">
              Q statistic
            </th>
            <th className="border-b border-neutral-800 px-2 py-1 text-left font-medium">
              p-value
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => {
            const isSignificant =
              row.pValue !== null && row.pValue < 0.05;
            return (
              <tr key={row.lag} className="border-b border-neutral-900">
                <td className="px-2 py-1">{row.lag}</td>
                <td className="px-2 py-1">
                  {formatAxisNumber(row.statistic)}
                </td>
                <td
                  className={`px-2 py-1 ${
                    isSignificant ? "text-red-400" : "text-neutral-200"
                  }`}
                >
                  {row.pValue !== null
                    ? formatAxisNumber(row.pValue)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
