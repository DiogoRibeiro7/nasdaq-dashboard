"use client";

import type { JSX, ChangeEvent } from "react";
import type { RobustnessMetric } from "@/lib/analytics/robustness";

const METRIC_OPTIONS: { label: string; value: RobustnessMetric }[] = [
  { label: "Total return", value: "totalReturn" },
  { label: "CAGR", value: "cagr" },
  { label: "Max drawdown", value: "maxDrawdown" },
  { label: "Sharpe", value: "sharpe" },
];

const SHORT_OPTIONS = [5, 10, 20, 30, 50];
const LONG_OPTIONS = [50, 100, 150, 200];

export type RobustnessControlsProps = {
  metric: RobustnessMetric;
  onMetricChange: (metric: RobustnessMetric) => void;
  shortWindow: number;
  longWindow: number;
  onShortWindowChange: (window: number) => void;
  onLongWindowChange: (window: number) => void;
};

export function RobustnessControls({
  metric,
  onMetricChange,
  shortWindow,
  longWindow,
  onShortWindowChange,
  onLongWindowChange,
}: RobustnessControlsProps): JSX.Element {
  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onMetricChange(event.target.value as RobustnessMetric);
  };

  const handleShortChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onShortWindowChange(Number(event.target.value));
  };

  const handleLongChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onLongWindowChange(Number(event.target.value));
  };

  return (
    <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
      <label className="flex items-center gap-2">
        Metric
        <select
          value={metric}
          onChange={handleMetricChange}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-500"
        >
          {METRIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        Short window start
        <select
          value={shortWindow}
          onChange={handleShortChange}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-500"
        >
          {SHORT_OPTIONS.filter((value) => value < longWindow).map((option) => (
            <option key={option} value={option}>
              {option}d
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        Long window start
        <select
          value={longWindow}
          onChange={handleLongChange}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-500"
        >
          {LONG_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}d
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
