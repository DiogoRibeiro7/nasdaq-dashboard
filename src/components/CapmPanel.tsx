import type { JSX } from "react";
import type { CapmStats } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CapmPanelProps = {
  stats: CapmStats;
  assetName: string;
  benchmarkName: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CapmPanel({
  stats,
  assetName,
  benchmarkName,
}: CapmPanelProps): JSX.Element {

  const hasStats =
    stats.beta !== null ||
    stats.alphaDaily !== null ||
    stats.alphaAnnual !== null ||
    stats.r2 !== null;

  const interpretation = (() => {
    if (stats.beta === null) {
      return "Insufficient overlapping history to estimate beta/alpha.";
    }
    if (stats.beta > 1.05) {
      return `${assetName} tends to move more than ${benchmarkName} (beta > 1 → higher sensitivity).`;
    }
    if (stats.beta < 0) {
      return `${assetName} often moves opposite to ${benchmarkName} (negative beta).`;
    }
    if (stats.beta < 0.95) {
      return `${assetName} is less volatile than ${benchmarkName} (beta < 1).`;
    }
    return `${assetName} closely tracks ${benchmarkName} (beta ≈ 1).`;
  })();

  return (
    <div className="flex flex-col gap-4">
      {hasStats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-500">Beta</p>
            <p className="text-lg font-semibold text-neutral-100">
              {formatNumber(stats.beta)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">R²</p>
            <p className="text-lg font-semibold text-neutral-100">
              {formatNumber(stats.r2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Alpha (daily)</p>
            <p className="text-lg font-semibold text-neutral-100">
              {formatPercent(stats.alphaDaily)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Alpha (annualized)</p>
            <p className="text-lg font-semibold text-neutral-100">
              {formatPercent(stats.alphaAnnual)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
          Add more overlapping history to estimate CAPM statistics.
        </div>
      )}
      <p className="text-xs text-neutral-400">{interpretation}</p>
    </div>
  );
}
