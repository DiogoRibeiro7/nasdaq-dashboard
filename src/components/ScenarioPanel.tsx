"use client";

import type { JSX } from "react";
import {
  applyShockScenario,
  type ShockScenario,
} from "@/lib/analytics/scenario";
import { formatPercent } from "@/lib/format";

export type ScenarioPanelProps = {
  scenarios: ShockScenario[];
  selectedScenarioName: string;
  onScenarioChange: (scenario: ShockScenario) => void;
  currentEquity: number;
};

export function ScenarioPanel({
  scenarios,
  selectedScenarioName,
  onScenarioChange,
  currentEquity,
}: ScenarioPanelProps): JSX.Element {
  const activeScenario =
    scenarios.find((scenario) => scenario.name === selectedScenarioName) ??
    scenarios[0];

  const result = activeScenario
    ? applyShockScenario(currentEquity, activeScenario)
    : { baseEquity: currentEquity, shockedEquity: currentEquity };

  const pctChange =
    result.baseEquity === 0
      ? 0
      : (result.shockedEquity - result.baseEquity) / result.baseEquity;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3">
        <label className="text-xs font-medium text-neutral-400">
          Scenario
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            value={activeScenario?.name ?? ""}
            onChange={(event) => {
              const next = scenarios.find(
                (scenario) => scenario.name === event.target.value,
              );
              if (next) {
                onScenarioChange(next);
              }
            }}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.name} value={scenario.name}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-neutral-400">
        <div>
          <div className="text-neutral-500">Base equity</div>
          <div className="mt-1 text-lg font-semibold text-neutral-100">
            {result.baseEquity.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-neutral-500">Shocked equity</div>
          <div className="mt-1 text-lg font-semibold text-neutral-100">
            {result.shockedEquity.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-neutral-500">Δ%</div>
          <div
            className={`mt-1 text-lg font-semibold ${
              pctChange >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatPercent(pctChange)}
          </div>
        </div>
      </div>
    </div>
  );
}
