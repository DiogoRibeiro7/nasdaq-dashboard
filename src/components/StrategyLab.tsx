"use client";

import type { JSX, ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { PREDEFINED_STRATEGIES, type StrategyConfig } from "@/lib/analytics/strategy_config";
import {
  generateSignalsFromConfig,
  type IndicatorSeriesMap,
} from "@/lib/analytics/strategy_engine";
import {
  backtestSignals,
  type PositionPoint,
  type GenericBacktestResult,
} from "@/lib/analytics/backtest";
import type { BacktestResult } from "@/lib/stats";
import { formatPercent } from "@/lib/format";
import { EquityCurveChart } from "@/components/EquityCurveChart";

export type StrategyLabProps = {
  symbol: string;
  priceSeries: { date: string; close: number }[];
  indicatorSeries: IndicatorSeriesMap;
};

export function StrategyLab({
  symbol,
  priceSeries,
  indicatorSeries,
}: StrategyLabProps): JSX.Element {
  const [selectedName, setSelectedName] = useState(PREDEFINED_STRATEGIES[0]?.name ?? "");
  const [configText, setConfigText] = useState(
    JSON.stringify(PREDEFINED_STRATEGIES[0], null, 2),
  );
  const [config, setConfig] = useState<StrategyConfig | null>(
    PREDEFINED_STRATEGIES[0] ?? null,
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const dates = useMemo(() => priceSeries.map((point) => point.date), [priceSeries]);

  const signals = useMemo<PositionPoint[]>(() => {
    if (!config || priceSeries.length === 0) {
      return [];
    }
    return generateSignalsFromConfig(dates, indicatorSeries, config);
  }, [config, dates, indicatorSeries, priceSeries.length]);

  const backtestResult = useMemo(() => {
    if (priceSeries.length === 0 || signals.length === 0) {
      return null;
    }
    const result = backtestSignals(priceSeries, signals);
    return result;
  }, [priceSeries, signals]);

  const convertedBacktest = useMemo<BacktestResult | null>(() => {
    if (!backtestResult) {
      return null;
    }
    return convertToBacktestResult(backtestResult);
  }, [backtestResult]);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = PREDEFINED_STRATEGIES.find(
      (entry) => entry.name === event.target.value,
    );
    setSelectedName(event.target.value);
    if (next) {
      setConfig(next);
      setConfigText(JSON.stringify(next, null, 2));
      setJsonError(null);
    }
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const nextText = event.target.value;
    setConfigText(nextText);
    try {
      const parsed = JSON.parse(nextText) as StrategyConfig;
      setConfig(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-400">
          Predefined strategy
          <select
            value={selectedName}
            onChange={handleSelectChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          >
            {PREDEFINED_STRATEGIES.map((strategy) => (
              <option key={strategy.name} value={strategy.name}>
                {strategy.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-400">
          Strategy config (JSON)
          <textarea
            value={configText}
            onChange={handleJsonChange}
            rows={18}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100 outline-none focus:border-neutral-500"
          />
        </label>
        {jsonError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-200">
            {jsonError}
          </div>
        )}
        {!jsonError && (
          <p className="text-xs text-neutral-500">
            Conditions accept indicators {`{ type, params }`} and operators (&gt;, &lt;, ==, etc.).
            Available series: MA windows [10, 20, 50, 100, 200], RSI period 14, regimes.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {convertedBacktest && backtestResult ? (
          <>
            <StrategySummary result={backtestResult} />
            <EquityCurveChart result={convertedBacktest} />
            <TradesTable trades={backtestResult.trades} />
          </>
        ) : (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
            Provide a valid config and ensure enough indicator history to run a backtest.
          </div>
        )}
      </div>
    </div>
  );
}

function convertToBacktestResult(
  result: GenericBacktestResult,
): BacktestResult {
  return {
    trades: result.trades.map((trade) => ({
      entryDate: trade.entryDate,
      exitDate: trade.exitDate,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      return: trade.grossReturn,
    })),
    equityCurve: result.equityCurve,
    totalReturn: result.totalReturn,
    maxDrawdown: result.maxDrawdown,
    cagr: result.cagr,
  };
}

function StrategySummary({
  result,
}: {
  result: GenericBacktestResult;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-neutral-100">Backtest metrics</h3>
        <p className="text-xs text-neutral-500">
          Totals based on generateSignalsFromConfig → backtestSignals pipeline.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Trades" value={result.trades.length.toString()} />
        <SummaryCard
          label="Hit rate"
          value={
            result.hitRate !== null ? formatPercent(result.hitRate) : "—"
          }
        />
        <SummaryCard
          label="Total return"
          value={formatPercent(result.totalReturn)}
        />
        <SummaryCard
          label="Max drawdown"
          value={formatPercent(result.maxDrawdown)}
        />
        <SummaryCard
          label="CAGR"
          value={
            result.cagr !== null
              ? formatPercent(result.cagr)
              : "—"
          }
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-50">{value}</div>
    </div>
  );
}

function TradesTable({
  trades,
}: {
  trades: GenericBacktestResult["trades"];
}): JSX.Element {
  if (trades.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        No completed trades for this configuration.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h4 className="text-sm font-semibold text-neutral-100">Trades</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="text-neutral-500">
            <tr>
              <th className="px-2 py-1 font-medium">Entry</th>
              <th className="px-2 py-1 font-medium">Exit</th>
              <th className="px-2 py-1 font-medium">Side</th>
              <th className="px-2 py-1 text-right font-medium">Return</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => (
              <tr key={`${trade.entryDate}-${index}`} className="border-t border-neutral-800/60">
                <td className="px-2 py-1 font-medium text-neutral-100">
                  {trade.entryDate}
                </td>
                <td className="px-2 py-1">
                  {trade.exitDate ?? "Open"}
                </td>
                <td className="px-2 py-1">
                  {trade.direction === 1 ? "Long" : "Short"}
                </td>
                <td className="px-2 py-1 text-right font-semibold text-neutral-100">
                  {trade.grossReturn !== null
                    ? formatPercent(trade.grossReturn)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
