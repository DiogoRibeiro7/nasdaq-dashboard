"use client";

import type { JSX } from "react";
import type { FactorRegressionResult } from "@/lib/analytics/factors";
import { formatNumber, formatPercent } from "@/lib/format";

export type FactorLoadingsPanelProps = {
  result: FactorRegressionResult;
  factorNames: string[];
};

const TRADING_DAYS_PER_YEAR = 252;

export function FactorLoadingsPanel({
  result,
  factorNames,
}: FactorLoadingsPanelProps): JSX.Element {
  const rows = factorNames.map((name, idx) => ({
    name,
    beta: result.betas[idx] ?? 0,
  }));

  const dominantRow = rows.reduce<{ name: string; beta: number } | null>(
    (best, row) => {
      if (!best) return row;
      return Math.abs(row.beta) > Math.abs(best.beta) ? row : best;
    },
    null,
  );

  const residualAnnual = result.residualStd * Math.sqrt(TRADING_DAYS_PER_YEAR);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[240px] text-left text-xs text-neutral-300">
          <thead>
            <tr className="text-neutral-500">
              <th className="pb-2 font-medium">Factor</th>
              <th className="pb-2 text-right font-medium">Beta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-neutral-800/50">
                <td className="py-1.5 font-semibold text-neutral-100">{row.name}</td>
                <td className="py-1.5 text-right text-neutral-100">
                  {formatNumber(row.beta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-xs text-neutral-400">
        <div>
          <dt className="text-neutral-500">Residual risk (annual)</dt>
          <dd className="font-semibold text-neutral-100">
            {formatPercent(residualAnnual)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">R²</dt>
          <dd className="font-semibold text-neutral-100">
            {formatPercent(result.r2)}
          </dd>
        </div>
      </dl>

      {dominantRow && (
        <p className="mt-4 text-xs text-neutral-400">
          {dominantRow.beta >= 0 ? "Positive" : "Negative"} beta vs{" "}
          <span className="font-semibold text-neutral-100">{dominantRow.name}</span>{" "}
          indicates the stock moves {dominantRow.beta >= 0 ? "with" : "opposite to"} that factor&apos;s
          swings.
        </p>
      )}
    </div>
  );
}
