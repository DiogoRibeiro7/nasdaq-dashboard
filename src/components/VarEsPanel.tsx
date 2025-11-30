"use client";

import type { JSX } from "react";
import type { VarEsResult } from "@/lib/analytics/risk";
import { formatPercent } from "@/lib/format";

export type VarEsPanelProps = {
  label: string;
  result: VarEsResult | null;
};

export function VarEsPanel({
  label,
  result,
}: VarEsPanelProps): JSX.Element {
  if (!result) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
        Not enough data to compute VaR/ES for {label}.
      </div>
    );
  }

  const rows = [
    {
      method: "Historical",
      varValue: result.varHist,
      esValue: result.esHist,
    },
    {
      method: "Normal approx.",
      varValue: result.varNorm,
      esValue: result.esNorm,
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-2 flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          {label}
        </div>
        <div className="text-[11px] text-neutral-500">
          Horizon {result.horizonDays}d · Confidence{" "}
          {formatPercent(result.confidence)}
        </div>
      </div>
      <table className="w-full table-fixed border-collapse text-xs text-neutral-200">
        <thead className="text-neutral-400">
          <tr>
            <th className="px-2 py-1 text-left font-medium">Method</th>
            <th className="px-2 py-1 text-right font-medium">VaR</th>
            <th className="px-2 py-1 text-right font-medium">Expected Shortfall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.method} className="border-t border-neutral-800">
              <td className="px-2 py-1 font-semibold text-neutral-100">
                {row.method}
              </td>
              <td className="px-2 py-1 text-right">
                {row.varValue !== null ? formatPercent(row.varValue) : "—"}
              </td>
              <td className="px-2 py-1 text-right">
                {row.esValue !== null ? formatPercent(row.esValue) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-neutral-500">
        VaR/ES represent potential losses over the chosen horizon. ES
        (a.k.a. CVaR) averages outcomes beyond VaR, so it is typically larger
        than VaR for the same confidence. Normal approximation assumes IID
        Gaussian log returns and may understate tail risk.
      </p>
    </div>
  );
}
