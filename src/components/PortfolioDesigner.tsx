"use client";

import type { JSX, ChangeEvent } from "react";
import type {
  RebalanceFrequency,
  TargetWeights,
} from "@/lib/analytics/portfolio_backtest";

const FREQUENCY_OPTIONS: RebalanceFrequency[] = ["daily", "weekly", "monthly"];

export type PortfolioDesignerProps = {
  symbols: string[];
  weights: TargetWeights;
  frequency: RebalanceFrequency;
  transactionCostBps: number;
  onWeightsChange: (weights: TargetWeights) => void;
  onFrequencyChange: (frequency: RebalanceFrequency) => void;
  onTransactionCostChange: (bps: number) => void;
};

export function PortfolioDesigner({
  symbols,
  weights,
  frequency,
  transactionCostBps,
  onWeightsChange,
  onFrequencyChange,
  onTransactionCostChange,
}: PortfolioDesignerProps): JSX.Element {
  const totalWeight = symbols.reduce(
    (sum, symbol) => sum + (weights[symbol] ?? 0),
    0,
  );

  const handleWeightChange = (
    symbol: string,
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const nextValue = Number(event.target.value) / 100;
    const updated: TargetWeights = {
      ...weights,
      [symbol]: Number.isFinite(nextValue) ? Math.max(nextValue, 0) : 0,
    };
    onWeightsChange(updated);
  };

  const normalizeWeights = (): void => {
    if (totalWeight <= 0) {
      return;
    }
    const normalized: TargetWeights = {};
    for (const symbol of symbols) {
      normalized[symbol] = (weights[symbol] ?? 0) / totalWeight;
    }
    onWeightsChange(normalized);
  };

  const handleFrequencyChange = (event: ChangeEvent<HTMLSelectElement>): void =>
    onFrequencyChange(event.target.value as RebalanceFrequency);

  const handleCostChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onTransactionCostChange(Number(event.target.value));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-400">
          Rebalance frequency
          <select
            value={frequency}
            onChange={handleFrequencyChange}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500"
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-400">
          Transaction cost (bps)
          <input
            type="number"
            min={0}
            step={1}
            value={transactionCostBps}
            onChange={handleCostChange}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Target weights</span>
          <button
            type="button"
            onClick={normalizeWeights}
            className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
          >
            Normalize
          </button>
        </div>
        <div className="space-y-2">
          {symbols.map((symbol) => (
            <label
              key={symbol}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            >
              <span className="font-semibold">{symbol}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={((weights[symbol] ?? 0) * 100).toFixed(1)}
                onChange={(event) => handleWeightChange(symbol, event)}
                className="w-24 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm focus:border-neutral-500"
              />
            </label>
          ))}
        </div>
        <div
          className={`text-xs ${
            Math.abs(totalWeight - 1) < 0.01
              ? "text-emerald-400"
              : "text-amber-400"
          }`}
        >
          Sum: {(totalWeight * 100).toFixed(1)}%
          {Math.abs(totalWeight - 1) >= 0.01 && " (click normalize)"}
        </div>
      </div>
    </div>
  );
}
