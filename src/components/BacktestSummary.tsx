"use client";

import type { JSX } from "react";
import type { BacktestResult } from "@/lib/stats";
import { formatPercent } from "@/lib/format";

export type BacktestSummaryProps = {
  result: BacktestResult;
  symbol: string;
  shortWindow: number;
  longWindow: number;
};

export function BacktestSummary({
  result,
  symbol,
  shortWindow,
  longWindow,
}: BacktestSummaryProps): JSX.Element {
  const tradeCount = result.trades.length;
  const profitable = result.trades.filter(
    (trade) => trade.return !== null && trade.return > 0,
  ).length;
  const hitRate =
    tradeCount > 0 ? (profitable / tradeCount) * 100 : null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-neutral-200">
          Backtest summary — {symbol} ({shortWindow}d / {longWindow}d)
        </h3>
        <p className="text-xs text-neutral-500">
          Long-only strategy: enter on golden cross, exit on death cross using closing prices.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Trades" value={tradeCount.toString()} />
        <SummaryCard
          label="Hit rate"
          value={hitRate !== null ? formatPercent(hitRate / 100) : "—"}
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

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-100">
        {value}
      </div>
    </div>
  );
}
